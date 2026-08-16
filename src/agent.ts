import express from 'express';
import 'dotenv/config'
import chatRouter from './chat.js';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 8080;

app.get('/', (req, res, next) => {
    return res.status(200).json({ message: 'hello world' })
})

app.use('/chat/v1', chatRouter)

app.listen(port, (err) => {
    if (err) {
        console.error(err);
        return;
    }
    console.info(`SERVER LISTENIN ON PORT : ${port} | ${process.env.ENV}`)
});