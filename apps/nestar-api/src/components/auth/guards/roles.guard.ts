import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "../auth.service";
import { Message } from "apps/nestar-api/src/libs/enums/common.enum";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector, // Reflector @Roles() tomonidan saqlangan role'ni olish uchun
    private authService: AuthService, //JWT tokenni tekshirish uchun
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.get<string[]>("roles", context.getHandler());

    if (!roles) return true;

    console.info(`--- @guard() Authentication [RolesGuard]: ${roles} ---`);

    if (context.getType() === "graphql") {
      const request = context.getArgByIndex(2).req;

      const bearerToken = request.headers.authorization;

      // Token umuman yuborilmagan
      if (!bearerToken) {
        throw new BadRequestException("Bearer token not provided");
      }

      const [bearer, token] = bearerToken.split(" ");

      // Bearer yoki token noto'g'ri
      if (bearer !== "Bearer" || !token) {
        throw new BadRequestException("Bearer token not provided");
      }

      const authMember = await this.authService.verifyToken(token);

      if (!authMember) {
        throw new ForbiddenException(Message.ONLY_SPECIFIC_ROLES_ALLOWED);
      }

      const hasPermission = roles.indexOf(authMember.memberType) > -1;

      if (!hasPermission) {
        throw new ForbiddenException(Message.ONLY_SPECIFIC_ROLES_ALLOWED);
      }

      console.log("memberNick[roles] =>", authMember.memberNick);

      request.body.authMember = authMember;

      return true;
    }

    // GraphQL bo'lmagan contextlar
    return true;
  }
}
