import { Chance } from 'chance';
import { v4 as uuid } from 'uuid';
import * as crypto from 'crypto';

export class Utility {
    static generateUniqueValue = (length = 35, num = false, prefix = null) => {
        const pool = num
            ? '0123456789'
            : 'abcdefghijklmnopqrstuvwxyz1234567890';
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
    static koboToNaira = value => {
        let convertedResult: number = value / 100;
        return convertedResult.toFixed(2);
    };

    static nairaToKobo = (value: number) => {
        let convertedResult: number = value * 100;

        return Math.round((convertedResult + Number.EPSILON) * 100) / 100;
    };

    static ucwords = (value: string) => {
        var str = value;
        str = str.toLowerCase().replace(/\b[a-z]/g, function (letter) {
            return letter.toUpperCase();
        });
        return str;
    };

    static hashString = phrase => {
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
    let passwordArray = [];

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
}
