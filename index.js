const MAIL_CONTRACT_TYPE = 8
const MAIL_SUCCESS_MSG = "@444";
const MAIL_FAILURE_NO_RECIPIENT = "@725";
const MAIL_FAILURE_TOO_MUCH_GOLD = "@723";
const MAIL_FAILURE_INBOX_FULL = "@733";
const MAIL_FAILURE_NO_GOLD = "@59";

module.exports = function MailFun (dispatch) {

	const command = dispatch.command;
	const config = require('./config.json');
	let sendingMail = false;
	let currentGold = 1;
	let currentRecipient = "";
	let manualInterrupt = false;
	let numParcelSent = 0;
	let maxParcels = 100; // other issues (such as recipient inbox becoming full...) notwithstanding, send this many parcels.

	dispatch.hook('S_INVEN', 19, event => {
		currentGold = event.gold;
	});	
	dispatch.hook('S_LOGIN', 14, event => {
		currentGold = 1;
	});

	command.add('mememailnum', (arg1) => {
		if (isNumber(arg1)){
			maxParcels = Math.max(Math.floor(arg1), 1);
			logMessage(`Target parcels to send: ${maxParcels}`)
		}
		else{
			logMessage(`Invalid input - numbers only.`)
		}
	})

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

	command.add('mememailstop', () => {
		manualInterrupt = true;
		logMessage(`Halting mail memes...`)
	});

	function sendMail(){		
		if(config.Subjects == undefined || config.Bodies == undefined){
			logMessage(`There was a problem parsing your config file.`)
			return;
		}
		if(currentGold < 1) {
			logMessage(`Not enough gold!`)
			return;
		}
		logMessage(`Proceeding to meme ${currentRecipient}'s mailbox! Up to ${maxParcels} will be sent.`)		
		initMail();
	}
	
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
