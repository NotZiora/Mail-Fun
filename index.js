const MAIL_CONTRACT_TYPE = 8
const MAIL_SUCCESS_MSG = "@444";
const MAIL_FAILURE_NO_RECIPIENT = "@725";
const MAIL_FAILURE_TOO_MUCH_GOLD = "@723";
const MAIL_FAILURE_INBOX_FULL = "@733";
const MAIL_FAILURE_NO_GOLD = "@59";

module.exports = function MemeMail (dispatch) {
	/*	
	- Mailing opcodes (currently) not mapped by Caali:
		- C_SET_SEND_PARCEL_TYPE
		- C_SET_SEND_PARCEL_MONEY
		- C_SEND_PARCEL		
	*/

	const command = dispatch.command;
	const config = require('./config.json');
	let sendingMail = false;
	let currentGold = 1;
	let currentRecipient = "";
	let manualInterrupt = false;
	let numParcelSent = 0;
	let maxParcels = 100; // other issues (such as recipient inbox becoming full...) notwithstanding, send this many parcels.

	// Update our gold.
	dispatch.hook('S_INVEN', 19, event => {
		currentGold = event.gold;
	});	
	dispatch.hook('S_LOGIN', 14, event => {
		currentGold = 1;
	});

	// :PepeStare:
	command.add('mememailnum', (arg1) => {
		if (isNumber(arg1)){
			maxParcels = Math.max(Math.floor(arg1), 1);
			logMessage(`Target parcels to send: ${maxParcels}`)
		}
		else{
			logMessage(`Invalid input - numbers only.`)
		}
	})

	// :PepePoggers:
	command.add('mememail', (arg1) => {
		if (arg1 != undefined) {
			manualInterrupt = false;
			currentRecipient = arg1;
			numParcelSent = 0;
			sendMail(arg1);			
		}
		else{
			logMessage(`Mailing recipient not specified.`);
		}
	})

	// :PepeCry:
	command.add('mememailstop', () => {
		manualInterrupt = true;
		logMessage(`Halting mail memes...`)
	});

	// :UwU: Let's go meme someone's mail-box.
	function sendMail(){		
		if(config.Subjects == undefined || config.Bodies == undefined){
			logMessage(`There was a problem parsing your config file.`)
			return;
		}
		// It costs 50 copper to send the message itself.
		if(currentGold < 1) {
			logMessage(`Not enough gold!`)
			return;
		}
		logMessage(`Proceeding to meme ${currentRecipient}'s mailbox! Up to ${maxParcels} will be sent.`)		
		initMail();
	}

	// :OwO: Gimme 'dat sweet sweet contract.
	function initMail() {
		if (manualInterrupt){
			manualInterrupt = false;
			logMessage(`You stopped meme'ing ${currentRecipient}'s inbox. Smh.`);
			resetMailState();
			return;
		}		
		if (numParcelSent >= maxParcels){
			logMessage(`Objective of ${maxParcels} have been sent to ${currentRecipient}, aborting.`);
			resetMailState();
			return;
		}		
		dispatch.toServer('C_REQUEST_CONTRACT', 1, {
			type: MAIL_CONTRACT_TYPE
		});		
		dispatch.hookOnce('S_REQUEST_CONTRACT', 1, (event) => {
			if(event.type == MAIL_CONTRACT_TYPE){
				let contractid = event.id;
				openMsg(contractid);
				attachGold(contractid);
				sendParcel(contractid, getMailSubject(), getMailBody());
			}
		})
	}

	// :PepeShrug:, technically speaking the first C_SET_SEND_PARCEL_TYPE should be unnecessary, but we're emulating client packet order.
	function openMsg(mailid){
		dispatch.toServer('C_SET_SEND_PARCEL_TYPE', 1, {
			contract: mailid,
			type: 0
		});
		dispatch.toServer('C_SET_SEND_PARCEL_TYPE', 1, {
			contract: mailid,
			type: 1
		});
	}

	function attachGold(mailid){
		dispatch.toServer('C_SET_SEND_PARCEL_MONEY', 1, {
			contract: mailid,
			gold: 1
		});
	}

	// Actually send the parcel, and process the first system message we get.
	function sendParcel(mailid, subject, body){
		dispatch.hookOnce('S_SYSTEM_MESSAGE', 1, (event) => {
			processMailResult(event.message);
		});		
		dispatch.toServer('C_SEND_PARCEL', 1, {
			contract: mailid,
			to: currentRecipient,
			title: subject,
			body: body
		});
	}

	function processMailResult(sysMsg) {		
		switch(sysMsg) {
			// :PepeWeird: Can you beat a 5th grader in a spelling-bee?
			case MAIL_FAILURE_NO_RECIPIENT:
				logMessage(`Invalid mailing recipient, aborting.`);
				resetMailState();
				break;
			// :PepeConfused: sometimes the game will think you're trying to send a lot of gold for some reason...
			case MAIL_FAILURE_TOO_MUCH_GOLD:
				logMessage(`Not sure what just happened, retrying in 5 seconds...`)
				setTimeout(initMail, 5000);				
				break;
			// :Pepehands: Smh no more memes for this guy today.
			case MAIL_FAILURE_INBOX_FULL:
				logMessage(`${currentRecipient}'s inbox can't hold anymore memes!`)
				resetMailState();
				break;
			// :ButReally:
			case MAIL_FAILURE_NO_GOLD:
				logMessage(`Too poor to meme. Aborting.`)
				resetMailState();
				break;
			// :PepePoggers:
			case MAIL_SUCCESS_MSG:
				numParcelSent++;
				reportResults();
				setTimeout(initMail, 2000);
				break;
			// :PepeThenk:
			// Make sure your all your subject-headers and mail-bodies are within the maximum-character restrictions.
			default:
				logMessage(`Unknown result code ${sysMsg}, aborting`);
				reportResults();
				break;
		}
	}

	// Convenience function :shrug:
	function resetMailState() {	
		currentRecipient = "";
		numParcelSent = 0;		
	}

	// Because we want everything logged in excrutiating detail.
	function reportResults() {
		logMessage(`Total parcels sent to ${currentRecipient}: ${numParcelSent}`)
	}

	// Log to proxy-channel and console (if specified).
	function logMessage(message, logConsole = false){
		if (logConsole){
			console.log(message)			
		}
		command.message(message) // don't forget to remove this when clientless botting.
	}

	// Fetch a random subject line (if any). Did you fill config.json with some spicy messages?
	function getMailSubject() {
		if (config.Subjects.length == 0){
			return `No Subject`;
		}		
		return config.Subjects[Math.floor(Math.random() * config.Subjects.length)]
	}

	// Fetch a random message body (if any). Did you fill config.json with some spicy messages?
	function getMailBody() {
		if (config.Bodies.length == 0){
			return `Smh`;
		}		
		return config.Bodies[Math.floor(Math.random() * config.Bodies.length)]		
	}

	// :PepeDerp:
	function isNumber(value) {
		return !isNaN(parseFloat(value)) && !isNaN(value - 0) 
	}
}
