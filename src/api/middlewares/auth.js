import tokenValidation from "../validations/tokenValidation.js";
const auth = (req, res, next) => {
  if (req.originalUrl.indexOf("/node/api/users/token_unique") > -1) {
    next();
    return;
  }

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.sendStatus(401);
    return;
  }
  tokenValidation(token, (valid, user, error) => {
    if (valid) {
      req.userId = user;
      next();
    } else {
      res.status(498).json(error);
    }
  });
};

export default auth;
