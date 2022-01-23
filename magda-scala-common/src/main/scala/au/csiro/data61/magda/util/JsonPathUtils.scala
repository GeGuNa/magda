package au.csiro.data61.magda.util

import au.csiro.data61.magda.model.Registry.Record
import gnieh.diffson._
import gnieh.diffson.sprayJson._
import spray.json.JsObject

object JsonPathUtils {

  def processRecordPatchOperationsOnAspects[T](
      recordPatch: JsonPatch,
      onReplaceAspect: (String, JsObject) => T,
      onPatchAspect: (String, JsonPatch) => T,
      onDeleteAspect: String => T
  ): Iterable[T] = {
    recordPatch.ops
      .groupBy(
        op =>
          op.path match {
            case "aspects" / (name / _) => Some(name)
            case _                      => None
          }
      )
      .filterKeys(_.isDefined)
      .map {
        // Create or patch each aspect.
        // We create if there's exactly one ADD operation and it's adding an entire aspect.
        case (
            Some(aspectId),
            List(Add("aspects" / (_ / rest), aValue))
            ) =>
          if (rest == Pointer.Empty)
            onReplaceAspect(
              aspectId,
              aValue.asJsObject
            )
          else
            onPatchAspect(
              aspectId,
              JsonPatch(Add(rest, aValue))
            )
        // We delete if there's exactly one REMOVE operation and it's removing an entire aspect.
        case (
            Some(aspectId),
            List(Remove("aspects" / (_ / rest), old))
            ) =>
          if (rest == Pointer.Empty) {
            onDeleteAspect(aspectId)
          } else {
            onPatchAspect(
              aspectId,
              JsonPatch(Remove(rest, old))
            )
          }
        // We patch in all other scenarios.
        case (Some(aspectId), operations) =>
          onPatchAspect(
            aspectId,
            JsonPatch(operations.map({
              // Make paths in operations relative to the aspect instead of the record
              case Add("aspects" / (_ / rest), aValue) =>
                Add(rest, aValue)
              case Remove("aspects" / (_ / rest), old) =>
                Remove(rest, old)
              case Replace("aspects" / (_ / rest), aValue, old) =>
                Replace(rest, aValue, old)
              case Move(
                  "aspects" / (sourceName / sourceRest),
                  "aspects" / (destName / destRest)
                  ) =>
                if (sourceName != destName)
                  // We can relax this restriction, and the one on Copy below, by turning a cross-aspect
                  // Move into a Remove on one and an Add on the other.  But it's probably not worth
                  // the trouble.
                  throw new RuntimeException(
                    "A patch may not move values between two different aspects."
                  )
                else
                  Move(sourceRest, destRest)
              case Copy(
                  "aspects" / (sourceName / sourceRest),
                  "aspects" / (destName / destRest)
                  ) =>
                if (sourceName != destName)
                  throw new RuntimeException(
                    "A patch may not copy values between two different aspects."
                  )
                else
                  Copy(sourceRest, destRest)
              case Test("aspects" / (_ / rest), aValue) =>
                Test(rest, aValue)
              case _ =>
                throw new RuntimeException(
                  "The patch contains an unsupported operation for aspect " + aspectId
                )
            }))
          )

        case _ =>
          throw new RuntimeException(
            "Aspect ID is missing (this shouldn't be possible)."
          )
      }
  }

  /**
    * Applied record JSON patch to a record and return patched record
    * @param currentRecord
    * @param recordPatch
    * @return
    */
  def getPatchedRecord(
      currentRecord: Record,
      recordPatch: JsonPatch
  ): Record = {
    val recordOnlyPatch = recordPatch.filter(
      op =>
        op.path match {
          case "aspects" / _ => false
          case _             => true
        }
    )
    var patchedRecord = recordOnlyPatch(currentRecord)

    processRecordPatchOperationsOnAspects(
      recordPatch,
      (aspectId, replaceObj) => {
        //onReplaceAspect
        patchedRecord = patchedRecord.copy(aspects = patchedRecord.aspects.map {
          item =>
            if (item._1 == aspectId) {
              (aspectId, replaceObj)
            } else {
              item
            }
        })
      },
      (aspectId, jsonPatch) => {
        //onPatchAspect
        patchedRecord = patchedRecord.copy(aspects = patchedRecord.aspects.map {
          item =>
            if (item._1 == aspectId) {
              (aspectId, jsonPatch(item._2).asJsObject)
            } else {
              item
            }
        })
      },
      aspectId => {
        // onDeleteAspect
        patchedRecord = patchedRecord.copy(
          aspects = patchedRecord.aspects.filter(_._1 != aspectId)
        )
      }
    )

    patchedRecord
  }

  /**
    * Apply Json path to policy engine record context json data
    * @param recordContextData
    * @param jsonPath
    * @return
    */
  def applyJsonPathToRecordContextData(
      recordContextData: JsObject,
      recordPatch: JsonPatch
  ): JsObject = {
    val recordOnlyPatch = recordPatch.filter(
      op =>
        op.path match {
          case "aspects" / _                         => false
          case path if (path == "authnReadPolicyId") => false
          case _                                     => true
        }
    )

    var patchedRecord = recordOnlyPatch(recordContextData).asJsObject

    processRecordPatchOperationsOnAspects(
      recordPatch,
      (aspectId, replaceObj) => {
        //onReplaceAspect
        patchedRecord = new JsObject(patchedRecord.fields.map { item =>
          if (item._1 == aspectId) {
            (aspectId, replaceObj)
          } else {
            item
          }
        })
      },
      (aspectId, jsonPatch) => {
        //onPatchAspect
        patchedRecord = new JsObject(patchedRecord.fields.map { item =>
          if (item._1 == aspectId) {
            (aspectId, jsonPatch(item._2).asJsObject)
          } else {
            item
          }
        })
      },
      aspectId => {
        // onDeleteAspect
        patchedRecord = new JsObject(
          patchedRecord.fields.filter(_._1 != aspectId)
        )
      }
    )

    patchedRecord
  }

}
