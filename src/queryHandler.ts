import type { ParsedUrlQuery } from "querystring";

import { isPrimitive } from "./helpers";
import {
  Type,
  QueryHandlerParams,
  QueryHandlerTypedParams,
  DEFAULT_SEPARATOR,
} from "./types";

export class QueryHandler<T, DC = Record<string, any>> {
  /**
   * Type is important to be set,
   * because query "123" provides unrecognized type by itself
   * Make sure, to set it to Type.Number, if you want to decode it to 123
   */
  public type: Type = Type.String;
  /**
   * Path in a parent object.
   * { filter: { wow: { dungeon: "Dungeon#1" }}}
   * results in `filter.wow.dungeon`
   * path is needed to decode
   */
  public path = "";
  /**
   * Query is a title of field in url query.
   * { gameTitle: new QueryHandler({ query: 'g' })}
   * results in URL query g=Wow,
   * but decoded result in gameTitle=Wow
   */
  public query: string;
  /**
   * Decode condition
   * There might be several handlers with the same query title
   * For example, you might not want to explode wow dungeon and lost ark dungeon
   * into two separate keys "wow_dungeon" and "lostark_dungeon", instead, you can make
   * @example
   * {
   *   game: 'wow' | 'lost ark',
   *   wowDungeon: new QueryHandler({ query: "dungeon", decodeCondition: { game: 'wow' } }),
   *   laDungeon: new QueryHandler({ query: "dungeon", decodeCondition: { game: 'lost ark' } }),
   * }
   */
  public decodeCondition: DC | undefined;
  /**
   * Aliases hashmap converts real value T to an alias
   * { mode : { aliases: { WowMythicPlus: 'mplus' }}}
   * results in URL query mode=mplus,
   * but decoded result in mode=WowMythicPlus
   */
  public aliases?: T extends string | number | symbol
    ? Record<T, string>
    : undefined;
  /**
   * Reversed aliases are saved during initialization
   * to do both encode and decode proccess faster
   */
  public reverseAliases?: Record<string, T>;
  /**
   * If false, js value won't be converted to query string
   * @default true
   */
  public encodable = true;
  /**
   * Separator value for encoding arrays
   * Do not put default value in variable to show memory mercy
   * @default ","
   */
  public separator = undefined;

  public decodeEmptyValue = false;
  public acceptEmptyValue = false;

  constructor(data: QueryHandlerParams<T, DC>) {
    this.query = data.query;
    this.decodeCondition = data.decodeCondition;

    if (data.decodeEmptyValue) {
      this.decodeEmptyValue = data.decodeEmptyValue;
    }
    if (data.decodeType) {
      this.type = data.decodeType;
    }
    if (data.encodable !== undefined) {
      this.encodable = data.encodable;
    }

    if (data.decodeType === Type.Boolean) {
      const boolData = data as QueryHandlerTypedParams<boolean>;
      if (boolData.acceptEmptyValue) {
        this.acceptEmptyValue = boolData.acceptEmptyValue;
      }
    }

    const strData = data as QueryHandlerTypedParams<string | number | symbol>;
    if (strData?.aliases) {
      const aliases = strData.aliases as any;
      this.aliases = aliases;
      this.reverseAliases = this.reverseMap(aliases);
    }
  }

  public clone<P>(decodeCondition: P): QueryHandler<T, P> {
    return new QueryHandler({
      query: this.query,
      decodeCondition: decodeCondition,
      decodeType: this.type,
      encodable: this.encodable,
      ...(this.aliases && { aliases: this.aliases }),
    } as QueryHandlerParams<T, P>);
  }

  /**
   * Encodes data value to query,
   * applies aliases if needed
   */
  public encode(data: T): string {
    if (data && this.acceptEmptyValue) {
      return "";
    }

    if (this.aliases && isPrimitive(data)) {
      const alias = this.aliases[data];

      return encodeURIComponent(alias || String(data));
    }

    if (Array.isArray(data)) {
      const serialized = data
        .map(encodeURIComponent)
        .join(this.separator || DEFAULT_SEPARATOR);

      return serialized;
    }

    return encodeURIComponent(String(data));
  }

  /**
   * Decodes query ("Dungeon#1") into T
   */
  public decode(query: string): T {
    const dataStr = decodeURIComponent(query);

    if (dataStr === "" && !this.decodeEmptyValue && !this.acceptEmptyValue) {
      return undefined as any;
    }

    if (this.reverseAliases) {
      const alias = this.reverseAliases[dataStr];

      return alias;
    }
    switch (this.type) {
      case Type.Boolean:
        if (this.acceptEmptyValue) {
          return true as any;
        }

        return Boolean(dataStr) as any;
      case Type.Number:
        return Number(dataStr) as any;
      case Type.String:
        return dataStr as any;
      case Type.Array:
        const encodedArray = dataStr.split(this.separator || DEFAULT_SEPARATOR);

        return encodedArray.map(decodeURIComponent) as any;
    }
  }

  public getFromQuery(query: string | ParsedUrlQuery): T | undefined {
    const search = new URLSearchParams(query);

    const data = search.get(this.query);
    if (data === null) {
      return undefined;
    }

    return this.decode(data);
  }

  public setPath(path: string[]): void {
    // if (this.path) {
    //   throw new Error(`Path already initialized for ${this.path}`);
    // }
    this.path = path.join(".");
  }

  private reverseMap(
    data: Record<string | number | symbol, string>
  ): Record<string, T> {
    return Object.keys(data).reduce(
      (acc, key) => ({ ...acc, [data[key]]: key as any }),
      {}
    );
  }
}
