package object.webhook

import data.common.hasNoConstaintPermission

default allow = false

# Only users has a unlimited permission to perfom the operation on "webhook" will be allowed
allow {
    hasNoConstaintPermission(input.operationUri)
}
