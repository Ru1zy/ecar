const score = document.querySelector('.score'),
  start = document.querySelector('.start'),
  gameArea = document.querySelector('.gamearea'),
  car = document.createElement('div');
car.classList.add('car');

start.addEventListener('click', startGame);
document.addEventListener('keydown', startRide);
document.addEventListener('keyup', stopRide);

const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowRight: false,
  ArrowLeft: false
};

const settings = {
  start: false,
  score: 0,
  speed: 5,
  traffic: 3
};

//кол-во объектов, которые можно уместить на странице в высоту (console.log(getQuantityElements()))
function getQuantityElements(heightElement) {
  return document.documentElement.clientHeight / heightElement + 1;
}

function startGame() {
  start.classList.add('hide');
  gameArea.innerHTML = '';
  score.style.top = 0;
  car.style.top = 'auto';
  car.style.bottom = '10px';
  car.style.left = '125px';
  for (let i = 0; i < getQuantityElements(50); i++){
    const line = document.createElement('div');
    line.classList.add('line');
    line.style.top = i * 50 + 'px';
    line.y = i * 50;
    gameArea.appendChild(line);
  }
  let backgrounds = [
      "transparent url('./img/enemy1.png') center / cover no-repeat",
      "transparent url('./img/enemy2.png') center / cover no-repeat",
      "transparent url('./img/enemy3.png') center / cover no-repeat"
    ];
  for (let i = 0; i < getQuantityElements(50*settings.traffic); i++){
    const enemy = document.createElement('div');
    enemy.classList.add('enemy');
    enemy.y = -100 * settings.traffic * (i + 1);
    enemy.style.left = Math.floor(Math.random() * (gameArea.offsetWidth - 50)) + 'px';
    enemy.style.top = enemy.y + 'px';
    enemy.style.background = backgrounds [Math.floor((Math.random() * backgrounds.length))];
    gameArea.appendChild(enemy);
  }
  settings.start = true;
  settings.score = 0;
  gameArea.appendChild(car);
  settings.x = car.offsetLeft;
  settings.y = car.offsetTop;
  requestAnimationFrame(playGame);
}

function playGame() {

  if (settings.start) {
    settings.score += settings.speed;
    score.innerHTML = 'скоре хере:<br>' + settings.score;
    moveRoad();
    enemyRide();
    if (keys.ArrowLeft && settings.x > 0) {
      settings.x -= settings.speed;
    }
    if (keys.ArrowRight && settings.x < (gameArea.offsetWidth - car.offsetWidth)) {
      settings.x += settings.speed;
    }
    if (keys.ArrowDown && settings.y < (gameArea.offsetHeight - car.offsetHeight)) {
      settings.y += settings.speed;
    }
    if (keys.ArrowUp && settings.y > 0) {
      settings.y -= settings.speed;
    }
    car.style.left = settings.x + 'px';
    car.style.top = settings.y + 'px';
    //console.log(settings.y);
    //console.log('here is ' + settings.x);
    requestAnimationFrame(playGame);
  }
}

function startRide(e) {
  e.preventDefault();
  keys[e.key] = true;
}

function stopRide(e) { 
  e.preventDefault();
  keys[e.key] = false;
}

function moveRoad() {
  let lines = document.querySelectorAll('.line');
  lines.forEach(function (line) {
    line.y += settings.speed;
    line.style.top = line.y + 'px';

    if (line.y >= document.documentElement.clientHeight) {
      line.y = -50;
    }
  });
}

function enemyRide() {
  let enemy = document.querySelectorAll('.enemy');
  let soundRect = new Audio('audio/dtp1.mp3');
  soundRect.preload = 'auto';
  enemy.forEach(function (ride) {
    let userRect = car.getBoundingClientRect();
    let enemyRect = ride.getBoundingClientRect();
    if (userRect.top <= enemyRect.bottom &&
      userRect.bottom >= enemyRect.top &&
      userRect.right >= enemyRect.left &&
      userRect.left <= enemyRect.right) {
      settings.start = false;
      soundRect.play();
      start.classList.remove('hide');
      score.style.top = start.offsetHeight;
    }
    ride.y += settings.speed / 2;
    ride.style.top = ride.y + 'px';
    if (ride.y >= document.documentElement.clientHeight) {
      ride.y = -100 * settings.traffic;
      ride.style.left = Math.floor(Math.random() * (gameArea.offsetWidth - 50)) + 'px';
    }

  });
}

