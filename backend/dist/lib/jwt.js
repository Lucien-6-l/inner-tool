import jwt from 'jsonwebtoken';
import { config } from '../config.js';
export function signAuthToken(payload) {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}
export function verifyAuthToken(token) {
    try {
        return jwt.verify(token, config.jwtSecret);
    }
    catch {
        return null;
    }
}
export function signOneTimeToken(payload) {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });
}
export function verifyOneTimeToken(token) {
    try {
        return jwt.verify(token, config.jwtSecret);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=jwt.js.map