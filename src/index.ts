import { QueryHandler } from "./queryHandler";
import {
  DeepQueryCoder,
  DeepQueryCoderWithParent,
  QueryHandlerMap,
} from "./types";

/**
 * QueryCoders
 */
export class QueryCoder<T> {
  private queryHandlers: QueryHandlerMap<T>;
  private queryEncoder: DeepQueryCoder<T>;

  constructor(data: DeepQueryCoder<T>) {
    this.queryEncoder = data;
    this.queryHandlers = this.deepCollectHandlers(data);
  }

  /** Tests if given arg is an object */
  private isObject(node: any): node is Record<any, any> {
    return typeof node === "object" && node;
  }

  /** Flat maps all leaves from coder to find decoder fast */
  private deepCollectHandlers<D>(
    data: DeepQueryCoderWithParent<D, T>,
    path: string[] = []
  ): QueryHandlerMap<T> {
    return Object.keys(data).reduce((acc, keyStr) => {
      const key = keyStr as keyof D;
      const value = data[key as keyof D];

      /** Value must be either node or QueryHandler leaf */
      if (!this.isObject(value)) {
        console.warn("shallow encoder unexpected type:", value);
        throw new Error("Unexpected type");
      }

      if (value instanceof QueryHandler) {
        if (!acc[value.query]) {
          acc[value.query] = [];
        }
        value.setPath([...path, keyStr]); // filter.wow.dungeon
        acc[value.query].push(value);

        return acc;
      }

      const shallowHandlers = this.deepCollectHandlers(
        value as DeepQueryCoderWithParent<D, T>,
        [...path, keyStr]
      );

      Object.keys(shallowHandlers).forEach((queryName) => {
        if (!acc[queryName]) {
          acc[queryName] = [];
        }

        acc[queryName].push(...shallowHandlers[queryName]);
      });

      return acc;
    }, {} as QueryHandlerMap<T>);
  }

  private deepEncode<D = T>(
    data: D,
    encoder: DeepQueryCoder<D>
  ): Record<string, string> {
    return Object.keys(data).reduce((acc, keyStr) => {
      const key = keyStr as keyof D;
      const value = data[key] as unknown;
      const shallowEncoder = encoder[key] as DeepQueryCoder<typeof value>;

      if (!shallowEncoder) {
        return acc;
      }

      // if node, go deeper
      if (this.isObject(value)) {
        return { ...acc, ...this.deepEncode(value, shallowEncoder) };
      }

      if (!(shallowEncoder instanceof QueryHandler)) {
        console.warn("shallow encoder unexpected type:", shallowEncoder);
        throw new Error("Unexpected type");
      }

      return { ...acc, [shallowEncoder.query]: shallowEncoder.encode(value) };
    }, {} as Record<string, string>);
  }

  /**
   * Encodes object to query string
   * @returns encoded query string
   */
  encode(data: T): string {
    const queryMap = this.deepEncode(data, this.queryEncoder);
    console.log(queryMap);
    const urlQuery = new URLSearchParams(queryMap);

    return urlQuery.toString();
  }

  /**
   * Decodes
   * @param query
   * @returns decoded object
   */
  decode(query: string): T {
    "game=Wow&gameMode=WowMythicPlus&language=En&faction=Alliance&dungeon=MistsOfTirnaScithe&rating=1400&region=Europe";
    const searchParams = new URLSearchParams(query);
    const params = Object.fromEntries([...(searchParams as any)]);

    Object.keys(params).map((key) => {
      const value = params[key];
      const handlers = this.queryHandlers[key];
      if (!handlers) {
        return;
      }
      if (handlers.length === 1) {
        const handler = handlers[0];
        const parsedValue = handler.decode(value);
      }
    });

    return {} as T;
  }
}