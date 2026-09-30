require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();


// ==================================================
// OPENAI
// ==================================================

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


// ==================================================
// CONFIGURAÇÕES DO SERVIDOR
// ==================================================

app.use(express.json());

app.use(express.static("public"));


// ==================================================
// PASTA DOS LIVROS
// ==================================================

const pastaLivros =
    path.join(__dirname, "uploads", "livros");


// Criar pasta automaticamente caso não exista
if (!fs.existsSync(pastaLivros)) {

    fs.mkdirSync(
        pastaLivros,
        {
            recursive: true
        }
    );

}


// ==================================================
// CONFIGURAÇÃO DO UPLOAD
// ==================================================

const storage = multer.diskStorage({

    destination: function (req, file, cb) {

        cb(
            null,
            pastaLivros
        );

    },

    filename: function (req, file, cb) {

        const nomeOriginal =
            path.parse(file.originalname).name;

        const extensao =
            path.extname(file.originalname);

        const nomeSeguro =
            nomeOriginal
                .replace(/[^a-zA-Z0-9À-ÿ_-]/g, "_")
                .substring(0, 100);

        const nomeFinal =
            `${Date.now()}-${nomeSeguro}${extensao}`;

        cb(
            null,
            nomeFinal
        );

    }

});


// ==================================================
// FILTRO DE ARQUIVOS
// ==================================================

const fileFilter =
    function (req, file, cb) {

        const extensao =
            path.extname(file.originalname)
                .toLowerCase();

        if (extensao === ".pdf") {

            cb(
                null,
                true
            );

        } else {

            cb(
                new Error(
                    "Apenas arquivos PDF são permitidos."
                ),
                false
            );

        }

    };


// ==================================================
// MULTER
// ==================================================

const upload = multer({

    storage: storage,

    fileFilter: fileFilter,

    limits: {

        fileSize:
            50 * 1024 * 1024

    }

});


// ==================================================
// LISTAR LIVROS
// ==================================================

app.get(
    "/api/livros",
    (req, res) => {

        try {

            const arquivos =
                fs.readdirSync(
                    pastaLivros
                );

            const livros =
                arquivos
                    .filter(
                        arquivo =>
                            path.extname(
                                arquivo
                            ).toLowerCase() === ".pdf"
                    )
                    .map(
                        arquivo => {

                            const caminho =
                                path.join(
                                    pastaLivros,
                                    arquivo
                                );

                            const estatisticas =
                                fs.statSync(
                                    caminho
                                );

                            return {

                                nome:
                                    arquivo,

                                tamanho:
                                    estatisticas.size,

                                criadoEm:
                                    estatisticas.birthtime,

                                url:
                                    `/livros/${encodeURIComponent(arquivo)}`

                            };

                        }
                    );

            res.json(
                livros
            );

        } catch (erro) {

            console.error(
                "Erro ao listar livros:",
                erro
            );

            res.status(500).json({

                erro:
                    "Não foi possível listar os livros."

            });

        }

    }
);


// ==================================================
// DISPONIBILIZAR PDFs
// ==================================================

app.use(
    "/livros",
    express.static(
        pastaLivros
    )
);


// ==================================================
// UPLOAD DE LIVRO
// ==================================================

app.post(
    "/api/livros/upload",
    upload.single("livro"),
    (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({

                    erro:
                        "Nenhum livro foi enviado."

                });

            }

            res.json({

                sucesso:
                    true,

                mensagem:
                    "Livro enviado com sucesso.",

                livro: {

                    nome:
                        req.file.filename,

                    nomeOriginal:
                        req.file.originalname,

                    tamanho:
                        req.file.size,

                    url:
                        `/livros/${encodeURIComponent(req.file.filename)}`

                }

            });

        } catch (erro) {

            console.error(
                "Erro no upload:",
                erro
            );

            res.status(500).json({

                erro:
                    "Não foi possível enviar o livro."

            });

        }

    }
);


// ==================================================
// APAGAR LIVRO
// ==================================================

app.delete(
    "/api/livros/:nome",
    (req, res) => {

        try {

            const nome =
                path.basename(
                    req.params.nome
                );

            const caminho =
                path.join(
                    pastaLivros,
                    nome
                );

            if (!fs.existsSync(caminho)) {

                return res.status(404).json({

                    erro:
                        "Livro não encontrado."

                });

            }

            fs.unlinkSync(
                caminho
            );

            res.json({

                sucesso:
                    true,

                mensagem:
                    "Livro eliminado com sucesso."

            });

        } catch (erro) {

            console.error(
                "Erro ao eliminar livro:",
                erro
            );

            res.status(500).json({

                erro:
                    "Não foi possível eliminar o livro."

            });

        }

    }
);


// ==================================================
// CHAT DA IA
// ==================================================

app.post(
    "/api/chat",
    async (req, res) => {

        try {

            const {
                pergunta
            } = req.body;

            if (
                !pergunta ||
                pergunta.trim() === ""
            ) {

                return res.status(400).json({

                    erro:
                        "A pergunta não pode estar vazia."

                });

            }

            const resposta =
                await client.responses.create({

                    model:
                        "gpt-5.6-luna",

                    instructions: `

Você é o FRANCIS FUTI AI,
um assistente inteligente especializado
principalmente em Engenharia Elétrica.

Responda em português de forma clara,
natural e didática.

Ajude o utilizador com:

- Engenharia Elétrica
- Circuitos elétricos
- Eletrónica
- Máquinas elétricas
- Sistemas de potência
- Instalações elétricas
- Automação e controlo
- Matemática aplicada à Engenharia
- Física aplicada
- Cálculos e resolução de exercícios

Quando houver cálculos,
apresente as etapas de forma organizada.

Se faltar alguma informação importante,
peça os dados necessários.

`,

                    input:
                        pergunta

                });

            res.json({

                resposta:
                    resposta.output_text

            });

        } catch (erro) {

            console.error(
                "Erro na API:",
                erro
            );

            res.status(500).json({

                erro:
                    "Não foi possível obter uma resposta da IA."

            });

        }

    }
);


// ==================================================
// SERVIDOR
// ==================================================

// A hospedagem poderá definir a porta através
// da variável PORT.
// Quando estivermos no computador,
// continuará usando a porta 3000.

const PORT =
    process.env.PORT || 3000;


// 0.0.0.0 permite que o servidor aceite
// conexões externas quando a hospedagem
// estiver configurada.

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `FRANCIS FUTI AI está funcionando na porta ${PORT}`
        );

        console.log(
            "Biblioteca de livros disponível."
        );

    }
);