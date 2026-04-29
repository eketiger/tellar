import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
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
  cors: {
    origin: [
      ...(process.env.WEB_ORIGIN || 'http://localhost:3000').split(','),
      ...(process.env.VIEWER_ORIGIN || '').split(','),
    ].map(s => s.trim()).filter(Boolean),
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;
  private liveTickHandle: ReturnType<typeof setInterval> | null = null;
  constructor(private jwt: JwtService, private prisma: PrismaService) {}

  afterInit() {
    // Broadcast the live socket count every 4s so the topbar LIVE
    // indicator reflects reality. Drift-tolerant: clients reconnecting
    // will receive the next tick within 4s of the gap.
    this.liveTickHandle = setInterval(() => {
      const sockets = this.server?.sockets;
      const count = sockets ? sockets.sockets.size : 0;
      try { this.server?.emit('live:count', { count }); } catch {/* noop */}
    }, 4000);
  }

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
