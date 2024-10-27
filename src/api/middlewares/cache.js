import memoryCache from "memory-cache";

/**
 * @param {Number} duration Timeout in seconds
 * @param {String} responseMethod Express Response
 */

const cache = (duration, responseMethod) => {
  return (req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    const key = "__express__" + req.originalUrl || req.url;
    const cachedResponse = memoryCache.get(key);

    if (cachedResponse) {
      res[responseMethod](cachedResponse);
      return;
    } else {
      res.sendResponse = res[responseMethod];
      res[responseMethod] = (body) => {
        memoryCache.put(key, body, duration * 1000);
        res.sendResponse(body);
      };
    }
    next();
  };
};

export default cache;
