import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(userData: Partial<User>): Promise<User> {
    const existingUser = await this.findByEmail(userData.email!);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const user = this.userRepository.create(userData);
    try {
      return await this.userRepository.save(user);
    } catch (err) {
      // Two concurrent registrations can both pass the check above; the unique
      // constraint (Postgres 23505) is the real guard — map it to a clean 409
      // instead of leaking a raw 500.
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException('User with this email already exists');
      }
      throw err;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    await this.userRepository.update(id, updateData);
    return this.findById(id);
  }
}
