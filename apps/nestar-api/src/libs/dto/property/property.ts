import { Field, Float, ObjectType } from "@nestjs/graphql";
import type{ ObjectId } from "mongoose";

import {
  PropertyLocation,
  PropertyStatus,
  PropertyType,
} from "../../enums/property.enum";

@ObjectType()
export class Property {
  @Field(() => String)
  _id!: string;

  @Field(() => PropertyType)
  propertyType!: PropertyType;

  @Field(() => PropertyStatus)
  propertyStatus!: PropertyStatus;

  @Field(() => PropertyLocation)
  propertyLocation!: PropertyLocation;

  @Field(() => String)
  propertyAddress!: string;

  @Field(() => String)
  propertyTitle!: string;

  @Field(() => Float)
  propertyPrice!: number;

  @Field(() => Float)
  propertySquare!: number;

  @Field(() => Float)
  propertyBeds!: number;

  @Field(() => Float)
  propertyRooms!: number;

  @Field(() => Float)
  propertyViews!: number;

  @Field(() => Float)
  propertyLikes!: number;

  @Field(() => Float)
  propertyComments!: number;

  @Field(() => Float)
  propertyRank!: number;

  @Field(() => [String])
  propertyImages!: string[];

  @Field(() => String, { nullable: true })
  propertyDesc?: string;

  @Field(() => Boolean)
  propertyBarter!: boolean;

  @Field(() => Boolean)
  propertyRent!: boolean;

  @Field(() => String)
  memberId!: ObjectId;

  @Field(() => Date, { nullable: true })
  soldAt?: Date;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date;

  @Field(() => Date, { nullable: true })
  constructedAt?: Date;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
