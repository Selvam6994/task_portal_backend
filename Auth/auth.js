import jwt from "jsonwebtoken";

export const auth = (request,response,next)=>{
    try {
        const token = request.header("x-auth-token");
        jwt.verify(token, process.env.STUDENT_TOKEN);
        next();
      } catch {
        response.status(401).send({ message: "not allowed" });
      }
}