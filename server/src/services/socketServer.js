import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ServiceOffer } from '../models/ServiceOffer.js';

export function configureSocketServer(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.accessToken;
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, env.jwt.accessSecret);
      socket.data.userId = String(payload.sub);
      next();
    } catch {
      next(new Error('Invalid or expired access token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);
    socket.data.offerRooms = new Set();

    socket.on('conversation:join', async (offerId, callback) => {
      try {
        const offer = await ServiceOffer.findById(offerId).select('buyerId sellerId');
        if (!offer || ![String(offer.buyerId), String(offer.sellerId)].includes(userId)) {
          return callback?.({ error: 'Conversation not found' });
        }
        const room = `offer:${offer.id}`;
        socket.join(room);
        socket.data.offerRooms.add(room);
        socket.to(room).emit('conversation:presence', { userId, online: true });
        const otherUserId = String(offer.buyerId) === userId ? String(offer.sellerId) : String(offer.buyerId);
        callback?.({ ok: true, otherOnline: Boolean(io.sockets.adapter.rooms.get(`user:${otherUserId}`)?.size) });
      } catch {
        callback?.({ error: 'Unable to join this conversation' });
      }
    });

    socket.on('conversation:typing', ({ offerId, typing }) => {
      const room = `offer:${offerId}`;
      if (socket.data.offerRooms.has(room)) {
        socket.to(room).emit('conversation:typing', { userId, typing: Boolean(typing) });
      }
    });

    socket.on('disconnecting', () => {
      const userRoom = `user:${userId}`;
      const lastConnection = (io.sockets.adapter.rooms.get(userRoom)?.size || 0) <= 1;
      if (lastConnection) {
        for (const room of socket.data.offerRooms) {
          socket.to(room).emit('conversation:presence', { userId, online: false });
        }
      }
    });
  });
}