/*
KeeFox - Allows Firefox to communicate with KeePass (via the KeeICE KeePass-plugin)
Copyright 2008-2009 Chris Tomlinson <keefox@christomlinson.name>
  
This hooks onto every common dialog in Firefox and for any dialog that contains one
username and one password (with the usual Firefox field IDs) it will discover
any matching logins and depending on preferences, etc. it will fill in the
dialog fields and/or populate a drop down box containing all of the matching logins.

TODO: extend so that new passwords can be saved automatically too (at the moment
you have to add them via KeePass)

Some ideas and code snippets from AutoAuth Firefox extension:
https://addons.mozilla.org/en-US/firefox/addon/4949

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/

Components.utils.import("resource://kfmod/KF.js");

var keeFoxDialogManager = {

    dialogInit : function(e) {
        try {
            keeFoxDialogManager.autoFill();
        } catch (exception) {
            KFLog.error(exception);
        }
    },
    
    // fill in the dialog with the first matched login found and/or the list of all matched logins
    autoFill : function()
    {    
        if (document.getElementById("loginTextbox")
		    && document.getElementById("password1Textbox")
		    && !document.getElementById("loginContainer").hidden)
		{
		    
		    // auto fill the dialog by default unless a preference or tab variable tells us otherwise
		    var autoFill = keeFoxInst._keeFoxExtension.prefs.getValue("autoFillDialogs",true);
            
            // do not auto submit the dialog by default unless a preference or tab variable tells us otherwise
            var autoSubmit = keeFoxInst._keeFoxExtension.prefs.getValue("autoSubmitDialogs",false);
            
            // overwrite existing username by default unless a preference or tab variable tells us otherwise
            var overWriteFieldsAutomatically = keeFoxInst._keeFoxExtension.prefs.getValue("overWriteFieldsAutomatically",true);
                
		    if (keeFoxInst._keeFoxExtension.prefs.has("lastProtocolAuthAttempt"))
            {
                if (Math.round(new Date().getTime() / 1000) - keeFoxInst._keeFoxExtension.prefs.get("lastProtocolAuthAttempt") <= 3)
                {
                    autoFill = false;
                    autoSubmit = false;
                }
            }
            
			if (document.getElementById("loginTextbox").getAttribute("value") != ''
			    && document.getElementById("password1Textbox").getAttribute("value") != ''
			    && !overWriteFieldsAutomatically)
			{	
			    autoFill = false;
                autoSubmit = false;
			}

			var host;
			var realm;
			
			matches = document.getElementById("info.body").firstChild.nodeValue.match(/https?:\/\/([\-\.a-zA-Z0-9]*?)(\s|:|\.\s|$)/);
            if (matches !== null && typeof matches[1] !== "undefined") {
                host = matches[1];
            }
            
            matches = document.getElementById("info.body").firstChild.nodeValue.match(/The\ssite\ssays:\s\"([^\"]*?)\"/);
            if (matches !== null && typeof matches[1] !== "undefined") {
                realm = matches[1];
            }
								
								
		    // if we're not logged in to KeePass then we can't go on
            if (!keeFoxInst._keeFoxStorage.get("KeeICEActive", false))
            {
                //TODO: put notification text on dialog box to inform user
                // and have button to load KeePass and then refresh the dialog?
                return;
            } else if (!keeFoxInst._keeFoxStorage.get("KeePassDatabaseOpen", false))
            {
                //TODO: put notification text on dialog box to inform user
                // and have button to load database and then refresh the dialog?
                return;
            }
        
			// find all the logins
			var foundLogins = keeFoxInst.findLogins({}, host, null, realm);

            if (KFLog.logSensitiveData)
                KFLog.info("dialog: found " + foundLogins.length + " matching logins for '"+ realm + "' realm.");
            else
                KFLog.info("dialog: found " + foundLogins.length + " matching logins for a realm.");
			
			if (foundLogins.length <= 0)
			    return;
			    
			var matchedLogins = [];
			var showList;
			
			// for every login
			for (var i = 0; i < foundLogins.length; i++)
			{
		        try {
		            var username = 
                        foundLogins[i].otherFields.queryElementAt(0,Components.interfaces.kfILoginField);
                    var password = 
                        foundLogins[i].passwords.queryElementAt(0,Components.interfaces.kfILoginField);
                   
			        matchedLogins.push({ 'username' : username.value, 'password' : password.value, 'host' : host });
			        showList = true;

		        } catch (e) {
		            KFLog.error(e);
		        }
			}
				
			// create a drop down box with all matched logins
			if (showList) {
				var box = document.createElement("hbox");

				var button = document.createElement("button");
				button.setAttribute("label", keeFoxInst.strbundle.getString("autoFillWith.label"));
				button.setAttribute("onclick",'keeFoxDialogManager.fill(document.getElementById("autoauth-list").selectedItem.username, document.getElementById("autoauth-list").selectedItem.password);');

				var list = document.createElement("menulist");
				list.setAttribute("id","autoauth-list");
				var popup = document.createElement("menupopup");
				var done = false;
			
				for (var i = 0; i < matchedLogins.length; i++){
					//for (var j = 0; j < possibleMatches[i].length; j++){
						var item = document.createElement("menuitem");
						item.setAttribute("label", matchedLogins[i].username + "@" + matchedLogins[i].host);
						item.username = matchedLogins[i].username;
						item.password = matchedLogins[i].password;

						popup.appendChild(item);
					
					//	done = true;
					//}
				
					//if (done) break;
				}

				list.appendChild(popup);
				box.appendChild(button);
				box.appendChild(list);

				document.getElementById("loginContainer").parentNode.appendChild(box);
			}

			
			
			if (autoFill)
			{
			    // fill in the first matching login
			    document.getElementById("loginTextbox").value = matchedLogins[0].username
			    document.getElementById("password1Textbox").value = matchedLogins[0].password
			    //matchedLogins[0].username
			    
			    
			    
			    //TODO: make a better guess about which login should be autofilled. e.g. exact host and realm match has higher priority
			
			}
			
			
			if (autoSubmit)
			{
			    commonDialogOnAccept();
			    window.close();
			}
				
				
		}
    },
    
    fill : function (username, password)
    {
		document.getElementById("loginTextbox").value = username;
		document.getElementById("password1Textbox").value = password;
		//document.getElementById("checkbox").checked = true;
		//onCheckboxClick(document.getElementById("checkbox"));
		
		commonDialogOnAccept();
		window.close();
	}


};

window.addEventListener("load", keeFoxDialogManager.dialogInit, false);

