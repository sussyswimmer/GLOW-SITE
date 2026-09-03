/* Prints a fresh 32-byte session key. Run: npm run secret
   Paste the value into the host's secret store as SESSION_SECRET.
   Rotating it signs everyone out, which is exactly what you want it
   to do the day you suspect it has leaked. */
import { randomBytes } from 'node:crypto';
console.log(randomBytes(32).toString('base64'));
