package object.webhook

import data.common.hasNoConstaintPermission
import data.common.hasOwnerConstaintPermission

default allow = false

# Only users has a unlimited permission to perfom the operation on "webhook" will be allowed
allow {
    hasNoConstaintPermission(input.operationUri)
}

# Rules for permissions with ownership constaint
# i.e. only owner of the webhook can perform the operation
allow {
    hasOwnerConstaintPermission(input.operationUri)
    # webhook field name should match table column name
    input.object.webhook.owner_id = input.user.id
}