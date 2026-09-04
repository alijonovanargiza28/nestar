import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { HttpModule } from "@nestjs/axios";
import { JwtModule } from "@nestjs/jwt";

@Module({
  imports: [
    HttpModule, //Bu NestJS'ga HTTP requestlar yuborish imkonini beradi.
    JwtModule.register({
      //Bu NestJS JWT modulini sozlayapti.
      secret: `${process.env.SECRET_TOKEN}`,
      signOptions: { expiresIn: "30d" },
    }),
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
