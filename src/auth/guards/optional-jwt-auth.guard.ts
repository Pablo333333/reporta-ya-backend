import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Override handleRequest to avoid throwing an exception if the user is not found
  handleRequest(err: any, user: any, _info: any) {
    if (err || !user) {
      return null;
    }
    return user;
  }
}
