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
}
