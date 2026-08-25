const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function runGit(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    return null;
  }
}

function showMenu() {
  console.clear();
  console.log("==========================================");
  console.log("       Git Quick Save & Load Menu         ");
  console.log("==========================================");
  console.log(" [1] Quick Load (Checkout target commit)");
  console.log(" [2] Quick Save (Commit current changes)");
  console.log("------------------------------------------");
  console.log(" [3] Save Slot 1");
  console.log(" [4] Save Slot 2");
  console.log(" [5] Save Slot 3");
  console.log(" [6] Save Slot 4");
  console.log(" [7] Save Slot 5");
  console.log(" [8] Save Slot 6");
  console.log(" [9] Save Slot 7");
  console.log(" [10] Save Slot 8");
  console.log(" [11] Save Slot 9");
  console.log("------------------------------------------");
  console.log(" [0] Exit");
  console.log("==========================================");

  rl.question("\nChoose an option (0-11): ", (answer) => {
    handleChoice(answer.trim());
  });
}

function handleChoice(choice) {
  switch (choice) {
    case '1':
      rl.question("Enter the commit hash or branch name to load: ", (target) => {
        if (target) {
          console.log(`\nSwitching to ${target}...`);
          const res = runGit(`git checkout ${target}`);
          console.log(res !== null ? "Success!" : "Error: Could not switch.");
        }
        promptReturn();
      });
      break;

    case '2':
      rl.question("Enter your quick save message: ", (msg) => {
        const message = msg.trim() || "Quick save snapshot";
        console.log("\nSaving changes...");
        runGit("git add .");
        const res = runGit(`git commit -m "${message}"`);
        console.log(res !== null ? "Successfully saved!" : "Nothing to commit or error occurred.");
        promptReturn();
      });
      break;

    // Slots 1 to 9 (Mapped to choices 3 through 11)
    case '3': case '4': case '5': case '6': case '7': 
    case '8': case '9': case '10': case '11':
      const slotNum = parseInt(choice) - 2; // Converts choice 3->1, 4->2, etc.
      handleSaveSlot(slotNum);
      break;

    case '0':
      console.log("Goodbye!");
      rl.close();
      break;

    default:
      console.log("Invalid option. Please try again.");
      setTimeout(showMenu, 1500);
      break;
  }
}

function handleSaveSlot(slot) {
  console.clear();
  console.log(`--- Save Slot ${slot} ---`);
  console.log(" [1] Save current progress into this slot (Tag it)");
  console.log(" [2] Load/Jump to this slot");
  console.log(" [3] Back to main menu");

  rl.question("\nChoose action for slot: ", (action) => {
    const tagName = `save-slot-${slot}`;
    if (action === '1') {
      // Save/Overwrite slot by moving or creating a git tag on the current HEAD
      runGit(`git tag -f ${tagName}`);
      console.log(`\nSuccessfully saved current state to Slot ${slot} (Tag: ${tagName})!`);
      promptReturn();
    } else if (action === '2') {
      // Load slot
      console.log(`\nLoading Slot ${slot}...`);
      const res = runGit(`git checkout ${tagName}`);
      console.log(res !== null ? `Successfully loaded Slot ${slot}!` : `Slot ${slot} is empty/does not exist yet.`);
      promptReturn();
    } else {
      showMenu();
    }
  });
}

function promptReturn() {
  rl.question("\nPress Enter to go back to the menu...", () => {
    showMenu();
  });
}

// Start the script
showMenu();
