package au.csiro.data61.magda.model

import au.csiro.data61.magda.model.Registry.Record
import spray.json.{
  DefaultJsonProtocol,
  JsArray,
  JsBoolean,
  JsFalse,
  JsNull,
  JsNumber,
  JsObject,
  JsString,
  JsTrue,
  JsValue
}
import scalikejdbc.interpolation.SQLSyntax

import scala.collection.SortedSet
import scala.collection.mutable.ListBuffer

object Auth {

  def recordToContextData(record: Record): JsObject = {
    val recordJsFields: ListBuffer[(String, JsValue)] = ListBuffer()

    recordJsFields += ("id" -> JsString(record.id))
    recordJsFields += ("name" -> JsString(record.name))
    recordJsFields += ("lastUpdate" -> JsNull)
    recordJsFields.appendAll(
      record.sourceTag.map("sourceTag" -> JsString(_))
    )
    recordJsFields.appendAll(
      record.tenantId.map("tenantId" -> JsNumber(_))
    )

    record.aspects.foreach(recordJsFields += _)

    JsObject(recordJsFields.toMap)
  }

  def isTrueEquivalent(value: JsValue): Boolean = {
    value match {
      case JsFalse       => false
      case JsNull        => false
      case JsString(str) => !str.isEmpty
      case JsNumber(v)   => v != 0
      case JsArray(v)    => v.length != 0
      case _             => true
    }
  }

  case class User(
      id: String,
      isAdmin: Boolean
  )

  case class ConciseOperand(
      isRef: Boolean,
      value: JsValue
  ) {

    def refString =
      if (!isRef) {
        throw new Error("Cannot convert non-ref term to ref string")
      } else {
        value match {
          case JsString(value) => value
          case _ =>
            throw new Error(
              s"Ref term has non-string type value: ${value.toString}"
            )
        }
      }

    def refStringWithoutPrefixes(prefixes: Set[String]) = {
      val sortedPrefixes = SortedSet.empty(
        Ordering.by[String, Int](_.length)(Ordering.Int.reverse)
      ) ++ prefixes

      sortedPrefixes.foldLeft(refString) {
        (
            ref: String,
            prefix: String
        ) =>
          if (ref.startsWith(prefix)) {
            ref.substring(prefix.length)
          } else {
            ref
          }
      }
    }

    def isCollectionRef = refString.endsWith("[_]")

    def extractAspectIdAndPath(
        prefixes: Set[String]
    ): (String, Seq[String], Boolean) = {
      // make it work for both "input.object.record" & "input.object.record." prefixe input
      // we remove the first leading `.` char (if any)
      val ref = refStringWithoutPrefixes(prefixes).replaceFirst("""^\.""", "")
      val parts = ref.split("\\.").filter(_ != "")
      if (parts.length < 2) {
        (ref, Nil, false)
      } else {
        val isCollection = parts(parts.length - 1).endsWith("[_]")
        (
          parts.head,
          parts
            .slice(1, if (isCollection) {
              parts.length - 1
            } else {
              parts.length
            })
            .toSeq,
          isCollection
        )
      }
    }

    def toAspectQueryValue = {
      if (isRef) {
        throw new Error(
          s"Attempt to covert reference `Operand` to `AspectQueryValue`: ${this.toString}"
        )
      }
      value match {
        case JsString(string)   => AspectQueryStringValue(string)
        case JsBoolean(boolean) => AspectQueryBooleanValue(boolean)
        case JsNumber(bigDec)   => AspectQueryBigDecimalValue(bigDec)
        case _ =>
          throw new Error(
            s"Failed to convert unsupported JsValue to AspectQueryValue: ${value.toString}"
          )
      }
    }

  }

  case class ConciseExpression(
      negated: Boolean,
      operator: Option[String],
      operands: Vector[ConciseOperand]
  ) {

    def toSqlOperator(regoOperator: String): SQLSyntax = {
      regoOperator match {
        case "="  => SQLSyntax.createUnsafely("=")
        case ">"  => SQLSyntax.createUnsafely(">")
        case "<"  => SQLSyntax.createUnsafely("<")
        case ">=" => SQLSyntax.createUnsafely(">=")
        case "<=" => SQLSyntax.createUnsafely("<=")
        case _ =>
          throw new Error(
            s"Failed to convert auth decision operator to SQL operator: unsupported operator: ${regoOperator}"
          )
      }
    }

    def toAspectQuery(
        prefixes: Set[String]
    ): AspectQuery = {
      if (operands.length == 1) {
        val (aspectId, path, isCollection) =
          operands(0).extractAspectIdAndPath(prefixes)
        if (isCollection) {
          AspectQueryArrayNotEmpty(aspectId, path, negated)
        } else {
          AspectQueryExists(aspectId, path, negated)
        }
      } else if (operands.length == 2) {
        val refOperand = operands.find(_.isRef)
        val valOperand = operands.find(!_.isRef)
        if (valOperand.isEmpty) {
          throw new Error(
            s"Failed to convert auth decision expression to AspectQuery: " +
              s"expression with both terms are references is currently not supported. Expression: ${this.toString}"
          )
        }

        if (refOperand.isEmpty) {
          // it's unlikely both terms are values as our decision API has already done the evaluation for this case.
          throw new Error(
            s"Failed to convert auth decision expression to AspectQuery: " +
              s"Terms shouldn't be both value. Expression: ${this.toString}"
          )
        }

        val (aspectId, path, isCollection) =
          refOperand.get.extractAspectIdAndPath(prefixes)

        if (isCollection && operator.get != "=") {
          throw new Error(
            "Failed to convert auth decision expression to AspectQuery: " + s"Only `=` operator is supported for collection reference. Expression: ${this.toString}"
          )
        }

        if (isCollection && operator.get == "=") {
          AspectQueryValueInArray(
            aspectId,
            path,
            valOperand.get.toAspectQueryValue,
            negated
          )
        } else {
          AspectQueryWithValue(
            aspectId,
            path,
            valOperand.get.toAspectQueryValue,
            toSqlOperator(operator.get),
            negated = negated,
            placeReferenceFirst = operands(0).isRef
          )
        }
      } else {
        throw new Error(
          s"Failed to convert auth decision expression to AspectQuery: more than 2 operands found. Expression: ${this.toString}"
        )
      }
    }
  }

  case class ConciseRule(
      default: Boolean,
      value: JsValue,
      fullName: String,
      name: String,
      expressions: List[ConciseExpression]
  ) {

    def toAspectQueryGroup(prefixes: Set[String]) = {
      AspectQueryGroup(
        queries = expressions.map(_.toAspectQuery(prefixes)),
        joinWithAnd = true,
        negated = !isTrueEquivalent(value)
      )
    }
  }

  case class AuthDecision(
      hasResidualRules: Boolean,
      result: Option[JsValue],
      residualRules: Option[List[ConciseRule]],
      hasWarns: Boolean,
      warns: Option[List[String]],
      unknowns: Option[List[String]] = None
  ) {

    def toAspectQueryGroups(
        prefixes: Set[String]
    ): Seq[AspectQueryGroup] = {
      if (hasResidualRules) {
        residualRules.toList.flatten.map(_.toAspectQueryGroup(prefixes))
      } else {
        if (isTrueEquivalent(result.getOrElse(JsFalse))) {
          // unconditional true
          Seq(AspectQueryGroup(queries = Seq(new AspectQueryTrue)))
        } else {
          Seq(AspectQueryGroup(queries = Seq(new AspectQueryFalse)))
        }

      }
    }

    def toSql(
        prefixes: Set[String] = Set("object.record"),
        recordIdSqlRef: String = "records.recordid",
        tenantIdSqlRef: String = "records.tenantid"
    ): Option[SQLSyntax] =
      SQLSyntax
        .toOrConditionOpt(
          this
            .toAspectQueryGroups(prefixes)
            .map(_.toSql(recordIdSqlRef, tenantIdSqlRef)): _*
        )
        .map(SQLSyntax.roundBracket(_))

  }

  val UnconditionalTrueDecision =
    AuthDecision(false, Some(JsTrue), None, false, None, None)

  val UnconditionalFalseDecision =
    AuthDecision(false, Some(JsFalse), None, false, None, None)

  trait AuthProtocols extends DefaultJsonProtocol {
    implicit val userFormat = jsonFormat2(User)
    implicit val conciseOperand = jsonFormat2(ConciseOperand)
    implicit val conciseExpressionFormat = jsonFormat3(ConciseExpression)
    implicit val conciseRuleFormat = jsonFormat5(ConciseRule)
    implicit val authDecisionFormat = jsonFormat6(AuthDecision)
  }
}
