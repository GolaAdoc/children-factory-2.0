import { IsEmail, IsNotEmpty, IsString, Length, Matches, MaxLength } from 'class-validator';

export class SignupDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(120)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 128)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/\S/, { message: 'Name must not be empty' })
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+923\d{9}$/)
  phoneNumber!: string;
}

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
