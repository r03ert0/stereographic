const exec = require('child_process').exec;

Promise.all([
    new Promise((res, rej) => {
        return exec( 'git ls-remote git://github.com/r03ert0/stereographic', (err,stdo,stde) => {
            if(err) {
                rej(stde);
                return;
            }
            res(stdo.split('\n')[0].split('\t')[0]);
        });
    }),
    new Promise((res, rej) => {
        return exec( 'git log --pretty=oneline', (err,stdo,stde) => {
            if(err) {
                rej(stde);
                return;
            }
            res(stdo.split('\n')[0].split(' ')[0]);
        });
    })
])
.then((vals) => {
    exec(`git rev-list ${vals[0]}..${vals[1]} --count`, (err, stdo, stde) => {
        if(err) {
            console.error(err);
            return;
        }
        if(parseInt(stdo)>0) {
            console.log(`There are ${parseInt(stdo)} new commits for the code`);
        } else {
            console.log('Code is up to date.');
        }
    })
});
