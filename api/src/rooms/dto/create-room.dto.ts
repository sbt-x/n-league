export class CreateRoomDto {
  // 部屋の表示名
  name: string;

  // 部屋に入れる最大人数（任意、指定がなければデフォルトを使う）
  maxPlayers?: number;
}
