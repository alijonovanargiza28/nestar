import { registerEnumType } from "@nestjs/graphql";

export enum Message {
  SOMETHING_WENT_WRONG = "Something went wrong!",
  NO_DATA_FOUND = "No data  found!",
  CREATE_FAILED = "Create  failed!",
  UPDATE_FAILED = "Update  failed!",
  REMOVE_FAILED = "Upload failed!",
  BAD_REQUEST = "Bad Request",

  USED_MEMBER_NICK_OR_PHONE = "Already used member nock or phone",
  USED_NICK_PHONE = "you are inserting already used nick or phone!",
  TOKEN_CREATION_FAILED = "Token creation error",
  NO_MEMBER_NICK = "No member with that member nick!",
  BLOCKED_USER = "you have been blocked, contact! admin",
  WRONG_PASSWORD = "Wrong password insered please try again!",
  NOT_AUTHENTICATED = "You are not authenticated, Please login first",
  TOKEN_NOT_EXIST = "Bearer Token is not provided!",
  ONLY_SPECIFIC_ROLES_ALLOWED = "ONLY_SPECIFIC_ROLES_ALLOWED",
}
export enum Direction {
  ASC = 1,
  DESC = -1,
}
registerEnumType(Direction, { name: "Direction" });
