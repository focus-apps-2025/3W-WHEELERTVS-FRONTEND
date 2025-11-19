const fs=require('fs');const lines=fs.readFileSync('src/components/AllResponses.tsx','utf8').split('\\n'); for(let i=2175;i<2310&&i<lines.length;i++){console.log((i+1)+': '+lines[i])}  
