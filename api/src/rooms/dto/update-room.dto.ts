import { IsOptional, IsInt, Min } from "class-validator";

export class UpdateRoomDto {
  @IsOptional()
  @IsInt()
  @Min(2)
  maxPlayers?: number;
}
