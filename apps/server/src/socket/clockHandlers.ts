import { Server, Socket } from 'socket.io';
import { ClockPingPayload, ClockPongPayload } from '../types/shared';

/**
 * NTP-style clock synchronization handler.
 *
 * Protocol:
 *   Client sends  clock:ping  { t0: client_epoch_ms }
 *   Server echoes clock:pong  { t0, t1: server_receive, t2: server_send }
 *
 * Client calculates:
 *   offset = ((t1 - t0) + (t2 - t3)) / 2
 *   rtt    = (t3 - t0) - (t2 - t1)
 *
 * Client runs 8 rounds and takes the median offset.
 */
export function registerClockHandlers(io: Server, socket: Socket): void {
  socket.on('clock:ping', (payload: ClockPingPayload) => {
    const t1 = Date.now();

    // Minimal delay between receive and send timestamps
    const t2 = Date.now();

    const pong: ClockPongPayload = {
      t0: payload.t0,
      t1,
      t2,
    };

    socket.emit('clock:pong', pong);
  });
}
