import { Logger } from '@nestjs/common';
import { OnGatewayInit, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Server } from 'ws';

@WebSocketGateway({ transports: ["websocket"], secure: false })
export class SocketGateway implements OnGatewayInit {
  private logger: Logger = new Logger("SocketEventsGateway");
  private summaryClient: number = 0; //Bu WebSocket'ga ulangan clientlar sonini saqlaydi.

  public afterInit(server: Server) {
    //Bu gateway ishga tushgandan keyin avtomatik chaqiriladigan method.
    this.logger.log(`WebSocket Server Initialized total:${this.summaryClient}`);
  }
  handleConnection(client: WebSocket, ...args: any[]) {
    (this.summaryClient++,
      this.logger.log(`== Client connected total:${this.summaryClient} ==`));
  }
  handleDisconnect(client: WebSocket) {
    this.summaryClient--;
    this.logger.log(`== Client disconnect left total:${this.summaryClient} ==`);
  }
  @SubscribeMessage("message") //"message" nomli eventni tingla.
  handleMessage(client: WebSocket, payload: any): string {
    return "Hello world!";
  }
}
