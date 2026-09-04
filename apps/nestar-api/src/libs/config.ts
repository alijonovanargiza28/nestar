import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";

// =========================================================
// SORT CONFIGURATION
// =========================================================

export const availableAgentSorts = [
  "createdAt",
  "updatedAt",
  "memberLikes",
  "memberViews",
  "memberRank",
];

export const availableMemberSorts = [
  "createdAt",
  "updatedAt",
  "memberLikes",
  "memberViews",
];

export const availableOptions = ["propertyBarter", "propertyRent"];

export const availablePropertySorts = [
  "createdAt",
  "updatedAt",
  "propertyLikes",
  "propertyViews",
  "propertyRank",
  "propertyPrice",
];

export const availableBoardArticleSorts = [
  "createdAt",
  "updatedAt",
  "articleLikes",
  "articleViews",
];

export const availableCommentSorts = ["createdAt", "updatedAt"];
// =========================================================
// IMAGE CONFIGURATION
// =========================================================

export const validMimeTypes = ["image/png", "image/jpg", "image/jpeg"];

export const getSerialForImage = (filename: string): string => {
  const ext = path.parse(filename).ext;

  return uuidv4() + ext;
};

// =========================================================
// OBJECT ID
// =========================================================

export const shapeIntoMongoObjectId = (
  target: string | mongoose.Types.ObjectId,
): mongoose.Types.ObjectId => {
  if (target instanceof mongoose.Types.ObjectId) {
    return target;
  }

  return new mongoose.Types.ObjectId(target);
};

// =========================================================
// LOOKUP MEMBER
// =========================================================

export const lookupMember = {
  $lookup: {
    from: "members",
    localField: "memberId",
    foreignField: "_id",
    as: "memberData",
  },
};
export const lookupFollowingData = {
  $lookup: {
    from: "members",
    localField: "followingId",
    foreignField: "_id",
    as: "followingData",
  },
};

export const lookupFollowerData = {
  $lookup: {
    from: "members",
    localField: "followerId",
    foreignField: "_id",
    as: "followerData",
  },
};
