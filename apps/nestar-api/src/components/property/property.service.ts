import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ViewService } from '../view/view.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class PropertyService {
  constructor(
    @InjectModel("Property") private readonly propertyModel: Model<null>,
  ) {}
}
