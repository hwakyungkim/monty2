import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// --- Interfaces ---

interface DoorState {
  hasPrize: boolean;
  isOpen: boolean;
  isSelected: boolean;
}

interface Stats {
  wins: number;
  losses: number;
}

interface SimulatorConfig {
  numberOfDoors: number;
  numberOfPrizes: number;
}

// --- Constants ---
const CAR_EMOJI = '🚗';
const GOAT_EMOJI = '🐐';

// --- Helper Functions ---
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Components ---

const Door: React.FC<{ door: DoorState; onClick: () => void; doorNumber: number }> = ({ door, onClick, doorNumber }) => (
  <div className={`door ${door.isOpen ? 'open' : ''} ${door.isSelected ? 'selected' : ''}`} onClick={onClick}>
    <div className="door-front">{doorNumber}</div>
    <div className="door-back">
      <span className="door-content">
        {door.hasPrize ? CAR_EMOJI : GOAT_EMOJI}
      </span>
    </div>
  </div>
);

const Simulator: React.FC<{ config: SimulatorConfig }> = ({ config }) => {
  const { numberOfDoors, numberOfPrizes } = config;
  
  const setupDoors = useCallback((): DoorState[] => {
    const doors: DoorState[] = Array(numberOfDoors).fill(null).map(() => ({ hasPrize: false, isOpen: false, isSelected: false }));
    let prizesPlaced = 0;
    while (prizesPlaced < numberOfPrizes) {
      const position = Math.floor(Math.random() * numberOfDoors);
      if (!doors[position].hasPrize) {
        doors[position].hasPrize = true;
        prizesPlaced++;
      }
    }
    return doors;
  }, [numberOfDoors, numberOfPrizes]);

  // --- State ---
  const [doors, setDoors] = useState<DoorState[]>(() => setupDoors());
  const [gameState, setGameState] = useState<'initial' | 'picked' | 'revealed' | 'finished'>('initial');
  const [message, setMessage] = useState(`${numberOfDoors}개의 문 중 하나를 선택하세요.`);
  const [manualStats, setManualStats] = useState({ stayWins: 0, switchWins: 0, total: 0 });

  const [simulations, setSimulations] = useState(1000);
  const [speed, setSpeed] = useState(50);
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stayStats, setStayStats] = useState<Stats>({ wins: 0, losses: 0 });
  const [switchStats, setSwitchStats] = useState<Stats>({ wins: 0, losses: 0 });
  const [animationData, setAnimationData] = useState<string[]>([]);
  
  const simulationStopped = useRef(false);

  // --- Manual Simulator Logic ---
  const resetManualGame = useCallback(() => {
    setDoors(setupDoors());
    setGameState('initial');
    setMessage(`${numberOfDoors}개의 문 중 하나를 선택하세요.`);
  }, [setupDoors, numberOfDoors]);

  useEffect(() => {
      resetManualGame();
  }, [resetManualGame]);

  const handleDoorClick = (clickedIndex: number) => {
    // If game is over, or host is "thinking", do nothing.
    if (gameState === 'finished' || gameState === 'picked') {
      return;
    }
  
    // Stage 1: User makes their initial choice
    if (gameState === 'initial') {
      // Mark the user's initial selection
      const newDoors = [...doors];
      newDoors[clickedIndex].isSelected = true;
      setDoors(newDoors);
      setGameState('picked'); // Enter "host is thinking" state
  
      // Host makes a move after a delay
      setTimeout(() => {
        setDoors(currentDoors => {
          // The host needs to open a door that wasn't picked and doesn't have a prize.
          const hostOpenableDoors = currentDoors.reduce<number[]>((acc, door, index) => {
            if (!door.isSelected && !door.hasPrize) {
              acc.push(index);
            }
            return acc;
          }, []);
  
          const hostOpenIndex = hostOpenableDoors[Math.floor(Math.random() * hostOpenableDoors.length)];
          
          // Return the new state of all doors with the host's choice revealed
          return currentDoors.map((door, index) => ({
            ...door,
            isOpen: index === hostOpenIndex,
          }));
        });
        
        setGameState('revealed');
        setMessage('선택을 유지하려면 원래 문을, 바꾸려면 다른 닫힌 문을 클릭하세요.');
      }, 1000);
      return;
    }
  
    // Stage 2: User makes their final choice by clicking a door
    if (gameState === 'revealed') {
      // The user can't click an already open door.
      if (doors[clickedIndex].isOpen) {
        return;
      }
  
      const initialChoiceIndex = doors.findIndex(d => d.isSelected);
      const switched = clickedIndex !== initialChoiceIndex;
      const hasWon = doors[clickedIndex].hasPrize;
  
      // Update statistics based on the outcome
      setManualStats(prev => ({
        ...prev,
        total: prev.total + 1,
        stayWins: (!switched && hasWon) ? prev.stayWins + 1 : prev.stayWins,
        switchWins: (switched && hasWon) ? prev.switchWins + 1 : prev.switchWins,
      }));
  
      // Set the final result message
      if (hasWon) {
        setMessage(switched ? '바꿔서 이겼습니다!' : '유지해서 이겼습니다!');
      } else {
        setMessage(switched ? '바꿔서 졌습니다.' : '유지해서 졌습니다.');
      }
  
      // Reveal all doors and mark the final selection
      setDoors(currentDoors =>
        currentDoors.map((door, index) => ({
          ...door,
          isOpen: true,
          isSelected: index === clickedIndex,
        }))
      );
      setGameState('finished');
    }
  };

  // --- Auto Simulator Logic ---
  const runSimulation = useCallback(async () => {
    setIsSimulating(true);
    simulationStopped.current = false;
    let localStayWins = 0;
    let localSwitchWins = 0;
    setStayStats({ wins: 0, losses: 0 });
    setSwitchStats({ wins: 0, losses: 0 });
    setProgress(0);
    setAnimationData([]);

    const delay = Math.max(0, 100 - speed);

    for (let i = 1; i <= simulations; i++) {
        if (simulationStopped.current) break;
        
        const currentDoors = Array(numberOfDoors).fill(false);
        let prizesPlaced = 0;
        while(prizesPlaced < numberOfPrizes){
            const pos = Math.floor(Math.random() * numberOfDoors);
            if(!currentDoors[pos]){
                currentDoors[pos] = true;
                prizesPlaced++;
            }
        }
        const playerChoice = Math.floor(Math.random() * numberOfDoors);

        if (currentDoors[playerChoice]) {
            localStayWins++;
        }

        const initialPickHasPrize = currentDoors[playerChoice];
        if (!initialPickHasPrize) {
            const otherDoors = Array.from({length: numberOfDoors}, (_, k) => k).filter(k => k !== playerChoice);
            const hostOpenable = otherDoors.filter(k => !currentDoors[k]);
            const hostOpened = hostOpenable[Math.floor(Math.random() * hostOpenable.length)];
            const switchable = otherDoors.filter(k => k !== hostOpened);
            const switchChoice = switchable[Math.floor(Math.random() * switchable.length)];
            if (currentDoors[switchChoice]) {
                localSwitchWins++;
            }
        }

        setStayStats({ wins: localStayWins, losses: i - localStayWins });
        setSwitchStats({ wins: localSwitchWins, losses: i - localSwitchWins });


        if (i % Math.ceil(simulations / 300) === 0) {
            const lastStayResult = currentDoors[playerChoice] ? 'win' : 'loss';
            setAnimationData(prevData => [...prevData.slice(-299), lastStayResult]);
        }

        if (i % Math.ceil(simulations / 100) === 0) {
            setProgress((i / simulations) * 100);
            if (delay > 0) {
              await sleep(delay);
            }
        }
    }
    setProgress(100);
    setIsSimulating(false);
  }, [simulations, speed, numberOfDoors, numberOfPrizes]);

  const handleStopSimulation = () => {
    simulationStopped.current = true;
    setIsSimulating(false);
  };

  const stayWinRate = stayStats.wins + stayStats.losses > 0 ? ((stayStats.wins / (stayStats.wins + stayStats.losses)) * 100).toFixed(1) : '0.0';
  const switchWinRate = switchStats.wins + switchStats.losses > 0 ? ((switchStats.wins / (switchStats.wins + switchStats.losses)) * 100).toFixed(1) : '0.0';

  return (
    <>
      <div className="section-card">
        <h2>수동 시뮬레이터</h2>
        <div className="doors-container">
          {doors.map((door, index) => (
            <Door key={index} door={door} doorNumber={index + 1} onClick={() => handleDoorClick(index)} />
          ))}
        </div>
        <p className="game-message">{message}</p>
        <div className="manual-controls">
          {gameState === 'finished' && <button onClick={resetManualGame}>새 게임</button>}
        </div>
        <div className="manual-stats">
          <p>총 게임: {manualStats.total}</p>
          <p>유지해서 이긴 횟수: {manualStats.stayWins}</p>
          <p>바꿔서 이긴 횟수: {manualStats.switchWins}</p>
        </div>
      </div>

      <hr />

      <div className="section-card">
        <h2>자동 시뮬레이터</h2>
        <div className="config-panel">
          <div className="config-item">
            <label htmlFor="simulations">시뮬레이션 횟수</label>
            <input
              id="simulations"
              type="number"
              value={simulations}
              onChange={(e) => setSimulations(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={isSimulating}
            />
          </div>
          <div className="config-item wide">
            <label htmlFor="speed">애니메이션 속도 (빠를수록 딜레이 적음): {speed}</label>
            <input
              id="speed"
              type="range"
              min="0"
              max="100"
              value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value))}
              disabled={isSimulating}
            />
          </div>
        </div>
        
        <div className="simulation-controls">
            {!isSimulating ? (
                 <button onClick={runSimulation} disabled={isSimulating}>시뮬레이션 시작</button>
            ) : (
                 <button onClick={handleStopSimulation} className="stop-button">시뮬레이션 중지</button>
            )}
        </div>

        {isSimulating && <progress value={progress} max="100"></progress>}
        
        <div className="animation-grid">
            {animationData.map((result, i) => <div key={i} className={`anim-door ${result}`}></div>)}
        </div>

        <div className="stats-container">
          <div className="stats-box">
            <h3>유지 전략</h3>
            <p>승리: {stayStats.wins.toLocaleString()}</p>
            <p>패배: {stayStats.losses.toLocaleString()}</p>
            <p>승률: <span className="win">{stayWinRate}%</span></p>
          </div>
          <div className="stats-box">
            <h3>바꾸기 전략</h3>
            <p>승리: {switchStats.wins.toLocaleString()}</p>
            <p>패배: {switchStats.losses.toLocaleString()}</p>
            <p>승률: <span className="win">{switchWinRate}%</span></p>
          </div>
        </div>
      </div>
    </>
  );
};


const App: React.FC = () => {
    const [config, setConfig] = useState<SimulatorConfig>({ numberOfDoors: 3, numberOfPrizes: 1 });
    const [tempConfig, setTempConfig] = useState({
        doors: config.numberOfDoors.toString(),
        prizes: config.numberOfPrizes.toString(),
    });
    const [error, setError] = useState('');

    const handleApplyConfig = () => {
        const doorCount = parseInt(tempConfig.doors, 10);
        const prizeCount = parseInt(tempConfig.prizes, 10);

        const validate = () => {
            if (isNaN(doorCount) || isNaN(prizeCount)) return '유효한 숫자를 입력하세요.';
            if (doorCount < 3) return '문의 개수는 3개 이상이어야 합니다.';
            if (prizeCount < 1) return '상품의 개수는 1개 이상이어야 합니다.';
            if (prizeCount >= doorCount) return '상품의 개수는 문 개수보다 적어야 합니다.';
            // To ensure the host can always open a goat door that wasn't picked
            if (doorCount - prizeCount < 2) {
                return '바꿀 수 있는 선택지를 남기려면, (문의 개수 - 상품의 개수)는 2 이상이어야 합니다.';
            }
            return '';
        };

        const errorMessage = validate();
        if (errorMessage) {
            setError(errorMessage);
            return;
        }

        setError('');
        setConfig({ numberOfDoors: doorCount, numberOfPrizes: prizeCount });
    };

    return (
        <div id="app">
            <h1>조건부확률 시뮬레이터</h1>

            <div className="section-card settings-panel">
              <h2>시뮬레이터 설정</h2>
              <p>시뮬레이션에 사용할 문과 상품의 개수를 설정하세요.</p>
              <div className="config-panel">
                <div className="config-item">
                  <label htmlFor="door-count">문의 개수</label>
                  <input
                    id="door-count"
                    type="text" 
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={tempConfig.doors}
                    onChange={(e) => setTempConfig({ ...tempConfig, doors: e.target.value })}
                  />
                </div>
                <div className="config-item">
                  <label htmlFor="prize-count">상품의 개수</label>
                  <input
                    id="prize-count"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={tempConfig.prizes}
                    onChange={(e) => setTempConfig({ ...tempConfig, prizes: e.target.value })}
                  />
                </div>
              </div>
              {error && <p className="error-message">{error}</p>}
              <button onClick={handleApplyConfig} className="apply-settings-button">
                설정 적용 & 시뮬레이션 초기화
              </button>
            </div>

            <Simulator key={JSON.stringify(config)} config={config} />
        </div>
    );
};


const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}