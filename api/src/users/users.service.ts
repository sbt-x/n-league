import { Injectable } from "@nestjs/common";

@Injectable()
export class UsersService {
  findAll() {
    return ["user1", "user2"];
  }
}
