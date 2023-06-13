import { io } from './http'

interface IResponse {
    status: boolean,
    mensagem: string
}

interface IUsersInfo {
    nome: string,
    numeroSala: number,
    color: string,
    respostas: { resposta: number }[]
    corretas?: number
}

interface IAlternativas {
    ordem: number,
    resposta: string,
    correta: boolean
}
interface IQuestao{
    pergunta: string
    alternativas : IAlternativas[]
}

let adminCreatedRooms: { room: string, admin: string, started: boolean }[] = [];
let userMap = new Map();

io.on('connection', (socket) => {
    socket.on('createRoom', (room: string, callback: (response: IResponse) => void) => {
        adminCreatedRooms.push({ room: room, admin: socket.id, started: false })
        callback({ status: true, mensagem: `Administrador criou a sala: ${room}` })
    });

    socket.on('joinRoom', (room: string, userInfo: IUsersInfo, callback: (response: IResponse) => void) => {
        let salaExiste = adminCreatedRooms.filter((roomCreated) => {
            return roomCreated.room == room
        })
        if (salaExiste.length > 0) {
            if (salaExiste[0].started) {
                callback({ status: false, mensagem: `Esta sala já está em andamento!` })
                return
            }
            userMap.set(socket.id, userInfo)
            socket.join(room);
            callback({ status: true, mensagem: `Aluno entrou na sala: ${room}` })
            let roomUserIds = io.sockets.adapter.rooms.get(room);
            if (roomUserIds) {
                let mappedUser = Array.from(roomUserIds)
                let usersInRoom: IUsersInfo[] = [];
                mappedUser.forEach((socketId) => {
                    let userInfo = userMap.get(socketId);
                    if (userInfo) {
                        usersInRoom.push(userInfo);
                    }
                });
                const usersInRoomString = JSON.stringify(usersInRoom);
                io.to(salaExiste[0].admin).emit('usersInRoom', usersInRoomString)
                io.to(mappedUser).emit('usersInRoomOnline',usersInRoom.length)
            }
        } else {
            callback({ status: false, mensagem: `Esta sala não existe!` })
        }
    });

    socket.on('startRoom', (roomStarted: string) => {
        const updatedAdminCreatedRooms = adminCreatedRooms.map(room => {
            if (room.room === roomStarted) {
                return { ...room, started: true };
            }
            return room;
        });
        adminCreatedRooms = updatedAdminCreatedRooms
    })

    socket.on('startQuestion', (room: string, questao: IQuestao, questaoAtiva, callback: (response: IResponse) => void) => {
        let newQuestao : IQuestao = 
        {
            pergunta: questao.pergunta,
            alternativas: questao.alternativas.map((alternativa)=>{
                return {
                    correta: false,
                    ordem: alternativa.ordem,
                    resposta: alternativa.resposta,
                }
            })
        }
        const questaoString = JSON.stringify(newQuestao);
        io.to(room).emit('nextQuestion', questaoString, questaoAtiva)
    })

    socket.on('showCorrect', (room: string, questao: IQuestao, callback: (response: IResponse) => void) => {
        let correta = questao.alternativas.filter((alternativa)=>{
            return alternativa.correta === true
        })
        if(correta.length > 0){
            io.to(room).emit('showCorrectQuestion', correta[0].ordem)
        }
    })

    socket.on('answerQuestion', (room: string, resposta: string, questaoAtiva: string, callback: (response: IResponse) => void) => {
        let admin = adminCreatedRooms.filter((adminRoom)=>{
            return adminRoom.room == room
        })
        if(admin.length > 0){
            let userInfo : IUsersInfo = userMap.get(socket.id);
            const usersInfoString = JSON.stringify(userInfo);
            socket.to(admin[0].admin).emit("answerQuestionUser", usersInfoString , resposta, questaoAtiva);
        }
    })

    socket.on('finishQuiz', (room : string ,users : IUsersInfo[])=>{
        const usersInfoString = JSON.stringify(users);
        io.to(room).emit('userPosition', usersInfoString)
    })

    socket.on('disconnect', () => {
        userMap.delete(socket.id);
    })
})