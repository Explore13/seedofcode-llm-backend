import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { ModelsService } from '../../models/models.service';

@ValidatorConstraint({ async: true })
@Injectable()
export class IsValidModelConstraint implements ValidatorConstraintInterface {
  constructor(private readonly modelsService: ModelsService) {}

  async validate(modelName: string, args: ValidationArguments) {
    if (!modelName || typeof modelName !== 'string') {
      return false;
    }

    try {
      const model = await this.modelsService.findByName(modelName);
      return !!(model && model.enabled);
    } catch (e) {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    return `Model '${args.value}' is not available or disabled.`;
  }
}

export function IsValidModel(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidModelConstraint,
    });
  };
}
