import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: (process.env.WEB_ORIGIN || 'http://localhost:3000').split(','), credentials: true },
})
export class RealtimeGateway {
  @WebSocketServer() server!: Server;
  constructor(private jwt: JwtService, private prisma: PrismaService) {}

  @SubscribeMessage('share:subscribe')
  async subscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { shareId: string; jwt: string },
  ) {
    try {
      const payload = await this.jwt.verifyAsync<any>(body.jwt);
      // Trim payload: only the one column we need for the tenant check.
      const share = await this.prisma.share.findUnique({
        where: { id: body.shareId },
        select: { teller: { select: { workspaceId: true } } },
      });
      if (!share || share.teller.workspaceId !== payload.ws) throw new WsException('forbidden');
      socket.join(`share:${body.shareId}`);
      return { ok: true };
    } catch {
      throw new WsException('unauthorized');
    }
  }

  broadcast(shareId: string, event: any) {
    this.server?.to(`share:${shareId}`).emit('event', event);
  }
}
