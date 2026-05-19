import { IsString, MinLength } from 'class-validator';

export class SavePushTokenDto {
  @IsString()
  @MinLength(10)
  pushToken: string;
}
