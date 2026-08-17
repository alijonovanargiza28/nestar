import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { GqlContextType, GqlExecutionContext } from "@nestjs/graphql";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  public readonly logger: Logger = new Logger();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const recordTime = Date.now();
    const requestType = context.getType<GqlContextType>();

    this.logger.log(`Type: ${requestType}`, "REQUEST");

    if (requestType === "http") {
      return next.handle().pipe(
        tap(() => {
          const responseTime = Date.now() - recordTime;

          this.logger.log(`After... ${responseTime}ms`, "REQUEST");
        }),
      );
    }

    if (requestType === "graphql") {
      const gqlContext = GqlExecutionContext.create(context);

      const body = gqlContext.getContext().req.body;

      console.log("gqlContext =>", body);

      return next.handle().pipe(
        tap((data) => {
          const responseTime = Date.now() - recordTime;

          this.logger.log(
            `Response: ${this.stringify(data)} - ${responseTime}ms`,
            "RESPONSE",
          );
        }),
      );
    }

    return next.handle();
  }

  private stringify(data: any): string {
    return JSON.stringify(data).slice(0, 75);
  }
}
