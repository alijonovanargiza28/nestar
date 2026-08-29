import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import PropertySchema from "../../schemas/Property.model";
import { AuthModule } from "../auth/auth.module";
import { ViewModule } from "../view/view.module";
import { MemberModule } from "../member/member.module";
import { PropertyResolver } from "./property.resolver";
import { PropertyService } from "./property.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: "Property",
        schema: PropertySchema,
      },
    ]),
    AuthModule,
    ViewModule,
    MemberModule
  ],
  providers: [PropertyResolver, PropertyService],
})
export class PropertyModule {}
