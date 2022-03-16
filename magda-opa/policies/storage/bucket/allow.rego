package storage.bucket

import data.common.hasNoConstraintPermission
import data.common.hasOwnerConstraintPermission
import data.common.hasOrgUnitConstaintPermission

default allow = false

# Only users has a unlimited permission to perform the operation on "storage bucket" will be allowed
allow {
    hasNoConstraintPermission(input.operationUri)
}

# Rules for permissions with ownership constraint
# i.e. only owner of the storage object (file) can perform the operation
allow {
    hasOwnerConstraintPermission(input.operationUri)
    # storage bucket tag ownerId should match current user's id
    input.storage.bucket.ownerId = input.user.id
}

# Rules for permissions with org unit constraint
allow {
    hasOrgUnitConstaintPermission(input.operationUri)
    # storage bucket tag orgUnitId should match current user's managingOrgUnitIds
    input.user.managingOrgUnitIds[_] = input.storage.bucket.orgUnitId
}