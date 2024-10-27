import tokenValidation from "../validations/tokenValidation.js";
const auth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.sendStatus(401);
    return;
  }
  tokenValidation(token, (valid, error) => {
    if (valid) {
      next();
    } else {
      res.status(498).json(error);
    }
  });
};

export default auth;
