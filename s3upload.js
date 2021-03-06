// new s3upload() to be called on event change of file input
var s3upload = (function(){
var initialize = function(evt){
		
		var uploads3 = {

		};	
		var that = this;
		//initiate multipartupload.
		//on response start sending chuncks
		//save chunk ids with chunk numbers as private table.
		that.response = function(){
			console.log(this.responseXML);
			uploads3.id = encodeURI(this.responseXML.getElementsByTagName("UploadId")[0].childNodes[0].nodeValue);
			uploads3.path = encodeURI(this.responseXML.getElementsByTagName("Key")[0].childNodes[0].nodeValue);
			that.startupload();
		};
		that.getid = function(){
			return uploads3.id;
		};
		that.getpath = function(){
			return uploads3.path;
		};
		
		that.setup =function(){
			
			var prog = document.createElement('div'); 
			var bar = document.createElement("div");
			bar.setAttribute("style","width:0%");
			bar.setAttribute("class","bar");

			prog.setAttribute("class", "progress progress-striped active");
			prog.appendChild(bar);
			
			that.elem = bar;
			this.parentNode.appendChild(prog);
			that.file = this.files[0];	
			console.log(that.file);
			//custom certification goes here, currently developing a node module to handle this.
			that.uploadoptions = {
            	type:"POST",
            	path:encodeURI("/mixes/"+that.file.name),
            	datatype:"binary/octel-stream",
            	bucket:"fuuzik",
            	endings:"?uploads"
            };
			$.ajax({
            url: "/certif",
            dataType: "JSON",
            type:"POST",
            contentType: "application/json",
            data:JSON.stringify(that.uploadoptions),
            success: function(data){
            	console.log(data);
	       	var request = new XMLHttpRequest();
	       	request.withCredentials = true;
	       	request.open("POST", "http://"+that.uploadoptions.bucket+".s3.amazonaws.com"+that.uploadoptions.path+"?uploads",true);	      	
	       	request.setRequestHeader("Authorization", "AWS "+data.s3Key+":"+data.s3Signature+"");
	  		request.setRequestHeader("X-Amz-Date" , data.s3Policy.expires);
	      	request.setRequestHeader("Content-Type","binary/octel-stream");
	      	request.onload = that.response;
	       	request.send();

            },
            error: function (res, status, error) {
                console.log(res);
                console.log("ERROR: " + error + " status: " + status + " response: " + res);
            }
        });
		};
		
			//send each chunk
		that.eachchunk = function(blob){
			var options = {
            	type:"PUT",
            	path:"/"+that.getpath(),
            
            	bucket:"fuuzik",
            	endings:encodeURI("?partNumber="+blob.index+"&uploadId="+that.getid().replace(/\s/g, ''))
            };

			$.ajax({
            url: "/certif",
            dataType: "JSON",
            type:"POST",
            contentType: "application/json",
            data:JSON.stringify(options),
            success: function(data){
            	
            var progressFunction = function(e){
            	
            	this.uprogress = e.loaded;
            	that.elem.setAttribute("style","width:"+that.progress()+"%");
            	that.elem.innerHTML = Math.round(that.progress())+"%";
            	
            };
            var bindxmlhttp = function(xhr){
            	return function(e){
            		progressFunction.call(xhr,e);
            	}
            }
			that.chunks[blob.index-1] = new XMLHttpRequest();
			that.chunks[blob.index-1].blob = blob;
			that.chunks[blob.index-1].uprogress = 0;
			that.chunks[blob.index-1].withCredentials = true;
			that.chunks[blob.index-1].open("PUT","http://"+options.bucket+".s3.amazonaws.com"+options.path+options.endings,true);
			that.chunks[blob.index-1].setRequestHeader("Authorization", "AWS "+data.s3Key+":"+data.s3Signature);
	  		that.chunks[blob.index-1].setRequestHeader("X-Amz-Date" , data.s3Policy.expires);
	      	//rememver to a add expose header
	      	 

    		that.chunks[blob.index-1].upload.addEventListener("progress", bindxmlhttp(that.chunks[blob.index-1]), false);  
			that.chunks[blob.index-1].onload = function(){

				//console.log(this.responseXML.getElementsByTagName("ETag")[0].childNodes[0].nodeValue);
			that.chunks[blob.index-1].etag = this.getResponseHeader("ETag").toString();
			that.etag++;
			if (that.etag == that.chunks.length) {
				that.complete();
			};
	      		
				
			};
			that.chunks[blob.index-1].send(blob.blob);
		

            },
            error: function (res, status, error) {
                console.log(res);
                console.log("ERROR: " + error + " status: " + status + " response: " + res);
            }
        });
	
		};
		that.etag = 0;
		that.chunks = [];
		that.progress = function(){
			var total = 0;
			for (var i = 0; i < that.chunks.length; i++) {
				total = total + that.chunks[i].uprogress;
			};
			
			return ((total/that.SIZE)*100)||0;
		}

		that.complete = function(){

			that.uploadoptions = {
            	type:"POST",
            	path:"/"+upload.getpath(),
            	datatype:"application/xml",
            	bucket:"fuuzik",
            	endings:"?uploadId="+upload.getid()
            };

			$.ajax({
            url: "/certif",
            dataType: "JSON",
            type:"POST",
            contentType: "application/json",
            data:JSON.stringify(that.uploadoptions),
            success: function(data){
            	
            	var xml = "<CompleteMultipartUpload>";
			for (var i = 0; i < that.chunks.length; i++) {
				
				xml = xml+"<Part>";
				xml = xml+"<PartNumber>"+that.chunks[i].blob.index+"</PartNumber>";
				xml = xml+"<ETag>"+that.chunks[i].etag+"</ETag>";
	
				xml = xml +"</Part>";
			
				
			};
			xml = xml+ "</CompleteMultipartUpload>";

			console.log(that.StringtoXML(xml));
			var complete = new XMLHttpRequest();
				complete.open("POST", "http://"+that.uploadoptions.bucket+".s3.amazonaws.com"+[that.uploadoptions.path]+""+[that.uploadoptions.endings]+"",true);	     
				complete.setRequestHeader("Authorization", "AWS "+data.s3Key+":"+data.s3Signature+"");
		  		complete.setRequestHeader("X-Amz-Date" , data.s3Policy.expires);
		      	complete.setRequestHeader("Content-Type","application/xml");
				complete.onload = function(){
					if (Math.round(that.progress())==100) {
            		that.elem.innerHTML = "Upload Complete!"
            		that.elem.setAttribute("class", "bar bar-success");
            	};
					console.log(this.responseXML);
				};
				complete.send(that.StringtoXML(xml));	
	       	

            },
            error: function (res, status, error) {
                console.log(res);
                console.log("ERROR: " + error + " status: " + status + " response: " + res);
            }
        });
			
		};
		that.slice = function(start,end){

			for (var prop in that.file) {
			    if (!that.file.hasOwnProperty(prop) && prop.indexOf("lice") > -1) {

			    	return that.file[prop](start,end);

			    }else{
			    	
			    }
			}
		}
		// called when a file is selected so this points to the event
		that.startupload = function(){

			that.BYTES_PER_CHUNK = 1024 * 1024 * 5; // 1MB chunk sizes.
	  		that.SIZE = that.file.size;
	  		that.nochunks = Math.round(that.file.size/that.BYTES_PER_CHUNK);
	  		that.startpoint = 0;
	  		that.end = that.BYTES_PER_CHUNK;
	  		that.index = 1;
	  		 while(that.startpoint < that.SIZE) {
	  		 	if (that.end> that.SIZE) {
	  		 		that.end = that.SIZE;
	  		 	};
			    that.eachchunk({
	    			"blob":that.slice(that.startpoint, that.end),
	    			"index":that.index,
	    			"parentid":uploads3.id,
	    			"size":that.BYTES_PER_CHUNK

	    		});

			    that.startpoint = that.end;
			    that.end = that.startpoint+ that.BYTES_PER_CHUNK;
			    that.index = that.index + 1;
				
			  }
	  
		};


		that.StringtoXML = function(text){
                if (window.ActiveXObject){
                  var doc=new ActiveXObject('Microsoft.XMLDOM');
                  doc.async='false';
                  doc.loadXML(text);
                } else {
                  var parser=new DOMParser();
                  var doc=parser.parseFromString(text,'text/xml');
                }
                return doc;
            };
 


		





};
initialize.prototype = {

status:function(){
 //returns the current status
},
resume:function(){
	//resumes this upload

},
pause:function(){
//pauses this upload
},
cancel:function(){
//cancels the upload and deletes data from s3.

}
}
return initialize;
})();

