// generate random string of specified int length
function randomString(length) {
    var result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
  
    return result;
}

function eventListenerGen(id, operation) {
  document.querySelector(id).addEventListener('click', operation)
}

export {randomString, eventListenerGen}