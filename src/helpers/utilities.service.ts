import { Chance } from 'chance';
import { v4 as uuid } from 'uuid';
import * as crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CloudinaryUploadResponse {
  public_id: string;
  url: string;
  secure_url: string;
}

export class Utility {
  private static isCloudinaryConfigured = false;

  private static ensureCloudinaryConfig() {
    if (!this.isCloudinaryConfigured) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      this.isCloudinaryConfigured = true;
    }
  }

  static generateUniqueValue = (length = 35, num = false, prefix = null) => {
    const pool = num ? '0123456789' : 'abcdefghijklmnopqrstuvwxyz1234567890';
    const chance = new Chance();
    const uniqueValue = chance.string({ length, pool });
    return prefix ? `${prefix}_${uniqueValue}` : uniqueValue;
  };
  static uuid = () => {
    return uuid();
  };
  static generateSession = () => {
    return Math.random().toString().replace('0.', '');
  };
  static slugify = (strings: string) => {
    return strings.toLowerCase().split(' ').join('_');
  };
  static koboToNaira = (value) => {
    const convertedResult: number = value / 100;
    return convertedResult.toFixed(2);
  };

  static nairaToKobo = (value: number) => {
    const convertedResult: number = value * 100;

    return Math.round((convertedResult + Number.EPSILON) * 100) / 100;
  };
  static CurrencyBroken = (value: number) => {
    const convertedResult: number = value * 100;

    return Math.round((convertedResult + Number.EPSILON) * 100) / 100;
  };

  static dollarToCent = (value: number) => {
    const convertedResult: number = value * 100;

    return Math.round((convertedResult + Number.EPSILON) * 100) / 100;
  };

  static centToDollar = (value) => {
    const convertedResult: number = value / 100;
    return convertedResult.toFixed(2);
  };
  static ucwords = (value: string) => {
    let str = value;
    str = str.toLowerCase().replace(/\b[a-z]/g, function (letter) {
      return letter.toUpperCase();
    });
    return str;
  };

  static hashString = (phrase) => {
    const { APIKEY_SECRET } = process.env;
    return crypto
      .createHmac('sha256', APIKEY_SECRET)
      .update(phrase)
      .digest('hex');
  };

  static randomPassword(length = 10, prefix = null) {
    if (length < 8) {
      console.error(
        'Password length must be at least 8 to include all character types.',
      );
      length = 8;
    }

    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numberChars = '0123456789';
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars =
      lowercaseChars + uppercaseChars + numberChars + specialChars;

    // Use an array to build the password
    const passwordArray = [];

    // Ensure at least one of each required character type is present
    passwordArray.push(
      lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)],
    );
    passwordArray.push(
      uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)],
    );
    passwordArray.push(
      numberChars[Math.floor(Math.random() * numberChars.length)],
    );
    passwordArray.push(
      specialChars[Math.floor(Math.random() * specialChars.length)],
    );

    // Fill the remaining length with random characters from the combined pool
    for (let i = 4; i < length; i++) {
      passwordArray.push(allChars[Math.floor(Math.random() * allChars.length)]);
    }

    // Shuffle the array to randomize the position of the required characters
    for (let i = passwordArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [passwordArray[i], passwordArray[j]] = [
        passwordArray[j],
        passwordArray[i],
      ];
    }

    // Join the array into a string
    const finalPassword = passwordArray.join('');

    return prefix ? `${prefix}_${finalPassword}` : finalPassword;
  }

  static uploadImage(
    file: any,
    folder: string,
  ): Promise<CloudinaryUploadResponse> {
    this.ensureCloudinaryConfig();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `${folder}` },
        (error, result) => {
          if (error) {
            return reject(
              new BadRequestException('Failed to upload image to cloudinary'),
            );
          } else if (result) {
            const response: CloudinaryUploadResponse = {
              public_id: result.public_id,
              url: result.url,
              secure_url: result.secure_url,
            };
            resolve(response);
          } else {
            reject(
              new BadRequestException('No result returned from cloudinary'),
            );
          }
        },
      );
      // Ensure file.buffer is passed
      if (file && file.buffer) {
        uploadStream.end(file.buffer);
      } else {
        reject(new BadRequestException('Invalid file buffer'));
      }
    });

    // const imageUrl = result.secure_url;
    // const publicId = result.public_id;
  }

  static async destroy(publicId: string): Promise<CloudinaryUploadResponse> {
    this.ensureCloudinaryConfig();

    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      throw new Error(`Cloudinary Deletion Error: ${error.message}`);
    }
  }
}
