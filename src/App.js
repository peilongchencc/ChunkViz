import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';
import { defaultProse, defaultJS, defaultPython, defaultMarkdown } from './defaultText.js';
import { CharacterTextSplitter, RecursiveCharacterTextSplitter } from "langchain/text_splitter";

class RecursiveCharacterTextSplitter_ext extends RecursiveCharacterTextSplitter {
  joinDocs(docs, separator) {
    // LangChain trims chunks, we don't want that for visuals!
    // Hacky override
    return docs.join(separator);
  }
}

class CharacterTextSplitter_ext extends CharacterTextSplitter {
  joinDocs(docs, separator) {
    // LangChain trims chunks, we don't want that for visuals!
    // Hacky override
    return docs.join(separator);
  }
}

const highlightChunks = (chunks) => {
  let highlightedText = '';
  const colors = ['#70d6ff', '#e9ff70', '#ff9770', '#ffd670', '#ff70a6'];

  chunks.forEach((chunk, index) => {
    let uniquePart, overlapPart;

    if (index === 0) {
      uniquePart = chunk.text.slice(0, chunk.text.length - chunk.overlapWithNext);
      overlapPart = chunk.text.slice(chunk.text.length - chunk.overlapWithNext);
    } else if (index !== chunks.length - 1) {
      uniquePart = chunk.text.slice(chunk.overlapWithNext, chunk.text.length - chunk.overlapWithNext);
      overlapPart = chunk.text.slice(chunk.text.length - chunk.overlapWithNext, chunk.text.overlapWithNext);
    } else { // It's the last chunk
      uniquePart = chunk.text.slice(chunk.overlapWithNext);
      overlapPart = ''; // There's no overlap with the next chunk
    }

    // Generate a pseudo-random color for each unique part using HSL
    const color = colors[index % colors.length];

    const highlightedChunk = `<span style="background: ${color}">${uniquePart}</span>`;
    highlightedText += highlightedChunk;

    // Add overlap part only if it's not the last chunk
    if (overlapPart) {
      highlightedText += `<span class="overlap">${overlapPart}</span>`;
    }
  });
  return highlightedText;
};

function App() {
  const [text, setText] = useState(defaultProse);
  const [chunkSize, setChunkSize] = useState(25);
  const [overlap, setOverlap] = useState(0);
  const [highlightedText, setHighlightedText] = useState('');
  const [splitter, setSplitter] = useState('characterSplitter');
  const [rawChunks, setRawChunks] = useState([]);
  const [overlapSize, setOverlapSize] = useState([]);

  const MAX_TEXT_LENGTH = 100000; // Define your maximum text length

  const splitterOptions = useMemo(() => ({
    'characterSplitter': {
      label: 'Character Splitter 🦜️🔗',
      language: null,
      chunk_overlap_ind: true,
      defaultText: defaultProse
    },
    'recursiveCharacterTextSplitter': {
      label: 'Recursive Character Text Splitter 🦜️🔗',
      language: null,
      chunk_overlap_ind: false,
      defaultText: defaultProse
    },
    'recursiveCharacterTextSplitterJS': {
      label: 'Recursive Character Text Splitter - JS 🦜️🔗',
      language: 'js',
      chunk_overlap_ind: false,
      defaultText: defaultJS
    },
    'recursiveCharacterTextSplitterPython': {
      label: 'Recursive Character Text Splitter - Python 🦜️🔗',
      language: 'python',
      chunk_overlap_ind: false,
      defaultText: defaultPython
    },
    'recursiveCharacterTextSplitterMarkdown': {
      label: 'Recursive Character Text Splitter - Markdown 🦜️🔗',
      language: 'markdown',
      chunk_overlap_ind: false,
      defaultText: defaultMarkdown
    },
  }), []);

  useEffect(() => {
    if (!splitterOptions[splitter].chunk_overlap_ind) {
      setOverlap(0);
    }

    // Get all default texts
    const defaultTexts = Object.values(splitterOptions).map(option => option.defaultText) || [];

    // Check if the current text is blank or a default text
    if (defaultTexts.includes(text)) {
      setText(splitterOptions[splitter].defaultText); // Set the default text for the selected splitter
    }
  }, [splitter, text, splitterOptions]);

  const handleTextChange = (event) => {
    let newText = event.target.value;
    if (newText.length > MAX_TEXT_LENGTH) {
      alert(`Error: Text cannot be longer than ${MAX_TEXT_LENGTH} characters. It will be trimmed to fit the limit.`);
      newText = newText.substring(0, MAX_TEXT_LENGTH);
    }
    setText(newText);
  };

  const handleChunkSizeChange = (event) => {
    let newChunkSize = Number(event.target.value);
    if (newChunkSize > overlap * 2) {
      setChunkSize(newChunkSize);
      setOverlapSize(newChunkSize * .45)
    }
  };

  const handleOverlapChange = (event) => {
    let newOverlap = Number(event.target.value);
    if (newOverlap <= chunkSize * 0.5) {
      setOverlap(newOverlap);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        setText(e.target.result);
      };
      reader.readAsText(file);
    }
  };

  const reconstructChunks = (chunks, chunkOverlap) => {
    let reconstructedText = [];
    let chunkData = [];
    let currentStartIndex = 0;

    chunks.forEach((chunk, index) => {
      const isLastChunk = index === chunks.length - 1;
      const startIndex = currentStartIndex; // Adjusted start index
      const endIndex = startIndex + chunk.length; // Adjusted end index

      reconstructedText.push(chunk);
      chunkData.push({
        id: index + 1,
        startIndex: startIndex,
        endIndex: endIndex,
        text: chunk,
        overlapWithNext: chunkOverlap
      });

      currentStartIndex = endIndex - (isLastChunk ? 0 : chunkOverlap); // Adjusted current start index
    });
    return chunkData;
  };

  const chunkTextSimple = async (text, chunkSize, overlap) => {
    if (!text) {
      return [];
    }
    const splitter = new CharacterTextSplitter_ext({
      separator: "",
      chunkSize: chunkSize,
      chunkOverlap: overlap,
      keepSeparator: true
    });

    const documents = await splitter.createDocuments([text]);

    let chunks = []
    for (let document of documents) {
      chunks.push(document.pageContent);
    }
    return chunks || []; // Ensure that an array is returned
  };

  const chunkTextRecursive = async (text, chunkSize, overlap, language) => {
    if (!text) {
      return [];
    }
    let splitter;
    if (language) {
      splitter = RecursiveCharacterTextSplitter_ext.fromLanguage(language, {
        chunkSize: chunkSize,
        chunkOverlap: overlap,
        keepSeparator: true
      });
    } else {
      splitter = new RecursiveCharacterTextSplitter_ext({
        chunkSize: chunkSize,
        chunkOverlap: overlap,
        keepSeparator: true
      });
    }

    const documents = await splitter.createDocuments([text]);

    let chunks = []
    for (let document of documents) {
      chunks.push(document.pageContent);
    }
    return chunks;
  };

  const renderTextWithHighlights = useCallback(async () => {
    let rawChunks;
    const language = splitterOptions[splitter].language;
    if (splitter.startsWith('characterSplitter')) {
      rawChunks = await chunkTextSimple(text, chunkSize, overlap);
    } else {
      rawChunks = await chunkTextRecursive(text, chunkSize, overlap, language);
    }
    setRawChunks(rawChunks); // Set the state variable
    const reconstructedChunks = reconstructChunks(rawChunks, overlap);
    const highlightedText = highlightChunks(reconstructedChunks);
    return highlightedText;
  }, [text, chunkSize, overlap, splitter, splitterOptions]);

  useEffect(() => {
    (async () => {
      const result = await renderTextWithHighlights();
      setHighlightedText(result);
    })();
  }, [renderTextWithHighlights]);

  return (
    <div className="App">
      <h1>ChunkViz v0.1</h1>
      <p>Language Models do better when they're focused.语言模型在专注时表现更好。</p>
      <p>One strategy is to pass a relevant subset (chunk) of your full data. There are many ways to chunk text.一种策略是传递您完整数据的相关子集（块）。这里有许多分块文本的方法。</p>
      <p>This is an tool to understand different chunking/splitting strategies.这是一个了解不同分块/分割策略的工具。</p>
      <p><a href='#explanation'>Explain like I'm 5...就像我有5岁一样解释...</a></p>
      <div className='textArea'>
        <textarea value={text} onChange={handleTextChange} rows={10} cols={50} />
        <div className='uploadButtonArea'>
          <label htmlFor="file-upload" className="custom-file-upload">
            <span style={{borderRadius: '5px', padding: '5px', fontSize: '12px', backgroundColor: '#d1dcff'}}>Upload .txt</span>
          </label>
          <input id="file-upload" type="file" accept=".txt" onChange={handleFileUpload} style={{ display: 'none' }} />
        </div>
      </div>
      <div>
        <div>
          <label>
            Splitter:
            <select value={splitter} onChange={(e) => setSplitter(e.target.value)}>
              {Object.entries(splitterOptions).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="slider-container">
          <label>
            <span style={{ display: 'inline-block', paddingRight: '10px' }}>Chunk Size:</span>
            <input
              type="number"
              min="1"
              max="2000"
              value={chunkSize}
              style={{ width: '50px' }}
              onChange={handleChunkSizeChange}
            />
            <input type="range" min="1" max="2000" value={chunkSize} onChange={handleChunkSizeChange} />
          </label>
        </div>
        <div className="slider-container">
          <label style={{ opacity: splitterOptions[splitter].chunk_overlap_ind ? 1 : 0.5 }}>
            <span style={{ display: 'inline-block', paddingRight: '10px' }}>Chunk Overlap:</span>
            <input
              type="number"
              min="0"
              max={overlapSize}
              value={overlap}
              style={{ width: '50px' }}
              onChange={handleOverlapChange}
              disabled={!splitterOptions[splitter].chunk_overlap_ind}
            />
            <input
              type="range"
              min="0"
              max={overlapSize}
              value={overlap}
              onChange={handleOverlapChange}
              disabled={!splitterOptions[splitter].chunk_overlap_ind}
            />
          </label>
        </div>
        <div>
          Total Characters: {rawChunks.reduce((a, b) => a + b.length, 0)}
        </div>
        <div>
          Number of chunks: {rawChunks.length}
        </div>
        <div>
          Average chunk size: {(rawChunks.reduce((a, b) => a + b.length, 0) / rawChunks.length).toFixed(1)}
        </div>
      </div>
      <div className="chunked-text">
        <div dangerouslySetInnerHTML={{ __html: highlightedText }} />
      </div>
      <hr style={{ width: '75%', marginTop: '15px' }} />
      <div id='info_box'>
        <h3 id="explanation">What's going on here?这里发生了什么？</h3>
        <p>Language Models have context windows. This is the length of text that they can process in a single pass.语言模型有上下文窗口。这是它们可以在单次处理中处理的文本长度。<br /> Although context lengths are getting larger, it has been shown that language models increase performance on tasks when they are given less (but more relevant) information.尽管上下文长度越来越大，但已经证明当语言模型获得更少（但更相关）的信息时，它们在任务上的性能会提高。</p>
        <p>But which relevant subset of data do you pick? This is easy when a human is doing it by hand, but turns out it is difficult to instruct a computer to do this.但你会选择哪个相关的数据子集？当人类手动操作时很容易，但事实证明，指导计算机这样做很困难。</p>
        <p>One common way to do this is by chunking, or subsetting, your large data into smaller pieces. In order to do this you need to pick a chunk strategy.其中一种常见的方法是通过将大型数据分块或分成更小的片段来完成。为了做到这一点，你需要选择一个分块策略。</p>
        <p>Pick different chunking strategies above to see how they impact the text, add your own text if you'd like.选择以上不同的分块策略来看看它们对文本的影响，如果你愿意，可以添加自己的文本。</p>
        <p>You'll see different colors that represent different chunks.你会看到代表不同分块的不同颜色。 <span style={{ background: "#ff70a6" }}>This could be chunk 1. </span><span style={{ background: "#70d6ff" }}>This could be chunk 2, </span><span style={{ background: "#e9ff70" }}>sometimes a chunk will change i</span><span style={{ background: "#ffd670" }}>n the middle of a sentence (this isn't great). </span><span style={{ background: "#ff9770" }}>If any chunks have overlapping text, those will appear in orange.</span></p>
        <p><b>Chunk Size 分块大小</b>: The length (in characters) of your end chunks 您的最终分块的长度（以字符为单位）。</p>
        <p><b>Chunk Overlap (Green) 分块重叠（绿色）</b>: The amount of overlap or cross over sequential chunks share 连续分块之间共享的重叠或交叉的数量。</p>
        <p><b>Notes:</b> *Text splitters trim the whitespace on the end of the js, python, and markdown splitters which is why the text jumps around, *Overlap is locked at &lt;*文本分割器会修剪 js、python 和 markdown 分割器末尾的空格，这就是为什么文本会跳来跳去，*重叠被锁定在分块大小的。</p>
        <p>For implementations of text splitters, view LangChain
          (<a href="https://python.langchain.com/docs/modules/data_connection/document_transformers/text_splitters/character_text_splitter" target="_blank" rel="noopener noreferrer">py</a>, <a href="https://js.langchain.com/docs/modules/data_connection/document_transformers/text_splitters/character_text_splitter" target="_blank" rel="noopener noreferrer">js</a>) & Llama Index (<a href="https://docs.llamaindex.ai/en/stable/api/llama_index.node_parser.SentenceSplitter.html#llama_index.node_parser.SentenceSplitter" target="_blank" rel="noopener noreferrer">py</a>, <a href="https://ts.llamaindex.ai/modules/low_level/node_parser" target="_blank" rel="noopener noreferrer">js</a>)</p>
        <p>MIT License, <a href="https://github.com/gkamradt/ChunkViz" target="_blank" rel="noopener noreferrer">Opened Sourced</a>, PRs Welcome</p>
        <p>Made with ❤️ by <a href="https://twitter.com/GregKamradt" target="_blank" rel="noopener noreferrer">Greg Kamradt</a></p>
      </div>
    </div>
  );
}

export default App;