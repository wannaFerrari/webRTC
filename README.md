# 1 to N screen-sharing program with chat

### used webRTC


### How to use?
```
 > Sender
  1. The person who wants to share the screen creates a room.
  2. Send auto-generated code to anyone who wants to participate.
  3. Select the screen you want to share.
  
 > Participants
  1. Enter the code you received.
  2. Select the screen. However, the screen is not actually shared. It's just for the connection.
 
 >> Extra function url
  '/create' : Create a room immediately. Sender's nickname will automatically set to 'sender'.
  '/screenOnly' : Join room with Full-Screen-Mode without any chat functions.
```

### install modules
```
  npm i nodemon -D
  npm i @babel/core @babel/cli @babel/node -D
  npm i @babel/preset-env -D
  npm i express
  npm i pug
  npm i ws
  npm i socket.io

```

### start program
```
  npm run dev
```

#### Then connect to localhost:5000