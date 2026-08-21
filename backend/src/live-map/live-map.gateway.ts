import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GPSDevice } from '../gps-devices/gps-device.entity';

export interface PositionPayload {
  deviceId: string;
  vehicleId: string | null;
  plateNumber: string | null;
  latitude: number;
  longitude: number;
  latitudeCleaned: number | null;
  longitudeCleaned: number | null;
  speed: number | null;
  heading: number | null;
  ignition: string | null;
  movement: string | null;
  timestamp: string;
}

@WebSocketGateway({
    cors: { origin: ['http://localhost:3000', 'http://192.168.50.71:3000', 'http://10.118.221.120:3000'] },
  namespace: '/live-map',
})
export class LiveMapGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LiveMapGateway.name);

  @WebSocketServer()
  server: Server;

  /** clientId → tenantId */
  private clientTenants = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(GPSDevice)
    private readonly devices: Repository<GPSDevice>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ??
        (client.handshake.headers?.authorization as string)?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn('WS connection rejected: no token');
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
      const tenantId: string = payload.tenantId ?? '';
      this.clientTenants.set(client.id, tenantId);
      client.join(`tenant:${tenantId}`);

      this.logger.log(`WS client connected: ${client.id} (tenant: ${tenantId})`);
    } catch (err) {
      this.logger.warn(`WS connection rejected: ${err instanceof Error ? err.message : err}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.clientTenants.delete(client.id);
    this.logger.log(`WS client disconnected: ${client.id}`);
  }

  broadcastPosition(tenantId: string, payload: PositionPayload) {
    this.server.to(`tenant:${tenantId}`).emit('position:update', payload);
  }
}
