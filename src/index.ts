import {serverHttp} from './http'
import './websocket'

serverHttp.listen(process.env.PORT || 5000,()=>{
    console.log('servidor rodando')
})